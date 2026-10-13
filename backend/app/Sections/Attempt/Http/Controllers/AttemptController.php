<?php

declare(strict_types=1);

namespace App\Sections\Attempt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\Attempt\Http\Requests\JawabRequest;
use App\Sections\Attempt\Http\Requests\KumpulkanRequest;
use App\Sections\Attempt\Http\Resources\AttemptHasilResource;
use App\Sections\Attempt\Http\Resources\AttemptResource;
use App\Sections\Attempt\Models\Attempt;
use App\Sections\Attempt\Services\AttemptService;
use App\Sections\Attempt\Services\TimService;
use App\Sections\Presence\Services\DenyutProteksiService;
use App\Sections\Presence\Services\PresenceService;
use App\Sections\Question\Models\Soal;
use App\Sections\Quiz\Models\Kuis;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pengerjaan kuis oleh murid. Semua keputusan (waktu, urutan, skor) dikerjakan
 * AttemptService; controller hanya memeriksa policy dan membungkus respons.
 */
class AttemptController extends Controller
{
    /**
     * Mulai atau lanjutkan attempt aktif murid untuk satu kuis.
     */
    public function mulai(
        Request $request,
        Kuis $kuis,
        AttemptService $service,
        PresenceService $presence,
        DenyutProteksiService $denyut,
    ): JsonResponse {
        $this->authorize('create', Attempt::class);
        $this->authorize('view', $kuis);

        $pengguna = $request->user();

        if ($pengguna === null) {
            abort(401, 'Sesi tidak ditemukan.');
        }

        $attempt = $service->mulai($kuis, $pengguna);

        // Mengerjakan kuis adalah bukti kehadiran yang paling kuat: tidak perlu
        // ping tambahan saat murid aktif.
        $presence->tandaiHadir($attempt, $this->sesi($request));

        return $this->bungkusAttempt($request, $attempt, $service, true, $denyut)->response()->setStatusCode(201);
    }

    /**
     * Status attempt berjalan + soal dalam urutan seed (tanpa kunci).
     */
    public function show(
        Request $request,
        Attempt $attempt,
        AttemptService $service,
        PresenceService $presence,
        DenyutProteksiService $denyut,
    ): AttemptResource {
        $this->authorize('view', $attempt);

        $attempt = $service->muat($attempt);

        // Memuat attempt = aktivitas normal murid; kehadiran ikut diperbarui
        // tanpa satu pun permintaan tambahan (chunk slice-07: presence hemat data).
        $presence->tandaiHadir($attempt, $this->sesi($request));

        // Saklar ikut dikirim saat halaman dimuat ulang; kalau tidak, proteksi
        // yang dinyalakan guru akan hilang hanya karena murid menyegarkan layar.
        return $this->bungkusAttempt($request, $attempt, $service, true, $denyut);
    }

    /**
     * Simpan satu jawaban (autosave). Server menolak setelah deadline.
     */
    public function jawab(
        JawabRequest $request,
        Attempt $attempt,
        AttemptService $service,
        PresenceService $presence,
    ): JsonResponse {
        $this->authorize('jawab', $attempt);

        /** @var Soal $soal */
        $soal = Soal::query()->findOrFail((int) $request->input('question_id'));

        // Pencatat jawaban (mode tim: siapa anggota yang mengubah, slice 09-C).
        $pengguna = $request->user();
        $pengguna?->loadMissing('murid');
        $penjawabId = $pengguna?->murid !== null ? (int) $pengguna->murid->getKey() : null;

        $jawaban = $service->simpanJawaban($attempt, $soal, $request->input('jawaban'), $penjawabId);

        $presence->tandaiHadir($attempt, $this->sesi($request));

        return response()->json([
            'message' => 'Jawaban tersimpan.',
            'question_id' => $soal->getKey(),
            'status' => $jawaban->status->value,
        ]);
    }

    /**
     * Kumpulkan + nilai. Idempoten lewat idempotency key dari klien dan status
     * attempt di server.
     */
    public function kumpulkan(
        KumpulkanRequest $request,
        Attempt $attempt,
        AttemptService $service,
        DenyutProteksiService $denyut,
    ): JsonResponse {
        $this->authorize('kumpulkan', $attempt);

        $attempt = $service->kumpulkan($attempt, (string) $request->validated('idempotency_key'));

        // Ulangan selesai = tidak ada lagi sensor yang perlu dijaga; tanpa ini
        // sapuan berikutnya akan menuduh murid yang sudah mengumpulkan.
        $denyut->matikan($attempt);

        return $this->bungkusHasil($attempt, $service)->response();
    }

    /**
     * Cap versi isi soal untuk layar pengerjaan (kebijakan 12 Oktober 2026).
     *
     * Halaman murid memanggil ini berkala selama ulangannya berjalan: jawabannya
     * kecil (satu hash), jadi murid bisa diberi tahu “guru memperbarui soal”
     * tanpa memuat seluruh payload soal berkali-kali. Bila capnya berubah, klien
     * memuat ulang payload (soal versi baru) sambil mempertahankan jawaban.
     */
    public function versiSoal(Attempt $attempt, AttemptService $service): JsonResponse
    {
        $this->authorize('view', $attempt);

        // Nama kolomnya sengaja sama dengan payload attempt (`versi_soal`), jadi
        // klien bisa membandingkan kedua sumber itu apa adanya.
        $versi = $service->versiSoal($attempt);

        return response()->json([
            'versi_soal' => $versi['versi'],
            'soal_diubah_at' => $versi['diubah_at'],
            'jumlah_soal' => $versi['jumlah_soal'],
        ]);
    }

    /**
     * Hasil ulangan (murid: miliknya sendiri; guru: untuk ditinjau).
     */
    public function hasil(Attempt $attempt, AttemptService $service): AttemptHasilResource
    {
        $this->authorize('hasil', $attempt);

        $attempt = $service->muatHasil($attempt);

        return $this->bungkusHasil($attempt, $service);
    }

    /**
     * Bungkus attempt berjalan + soal (dan saklar proteksi untuk murid).
     *
     * Saklar anti-cheat dikirim ke klien supaya klien men-gate sendiri: bila
     * semua proteksi mati, klien tidak memasang sensor apa pun (dan tidak
     * mengirim apa pun). Saklar tetap ditentukan server.
     */
    private function bungkusAttempt(
        Request $request,
        Attempt $attempt,
        AttemptService $service,
        bool $denganProteksi = false,
        ?DenyutProteksiService $denyut = null,
    ): AttemptResource {
        $resource = new AttemptResource($attempt);
        // Soal hidup dimuat sekali untuk payload + versi (dulu dua query identik per request).
        $hidup = $service->soalHidup($attempt);
        $resource->soal = $service->payloadSoal($attempt, $hidup);
        $resource->versiSoal = $service->versiSoal($attempt, $hidup);
        $resource->jawaban = $service->payloadJawaban($attempt);
        $resource->tim = $this->timMurid($attempt, $request);

        if ($denganProteksi) {
            $proteksi = $service->saklarAntiCheat($attempt->kuis);

            $resource->proteksi = $proteksi;
            $resource->denyut = $this->denyutUntuk($request, $attempt, $proteksi, $denyut);
        }

        return $resource;
    }

    /**
     * Siapkan denyut proteksi ber-nonce untuk payload murid (2D).
     *
     * Hanya murid pemilik yang memicunya: guru yang membuka attempt yang sama
     * (mis. meninjau) tidak boleh merotasi nonce milik murid dan membuat
     * denyutnya tertolak. Bila tidak ada satu pun saklar menyala, nonce justru
     * dimatikan — tidak ada sensor yang perlu dijaga.
     *
     * @param  array<string, bool>  $proteksi
     * @return array{nonce: string, interval_detik: int}|null
     */
    private function denyutUntuk(
        Request $request,
        Attempt $attempt,
        array $proteksi,
        ?DenyutProteksiService $denyut,
    ): ?array {
        if ($denyut === null || $request->user()?->isMurid() !== true) {
            return null;
        }

        if (! in_array(true, $proteksi, true)) {
            $denyut->matikan($attempt);

            return null;
        }

        return [
            'nonce' => $denyut->aktifkan($attempt),
            'interval_detik' => DenyutProteksiService::JEDA_DETIK,
        ];
    }

    /**
     * Ringkasan tim untuk layar murid (mode tim, slice 09-C).
     *
     * @return array<string, mixed>|null
     */
    private function timMurid(Attempt $attempt, Request $request): ?array
    {
        if ($attempt->team_id === null) {
            return null;
        }

        $pengguna = $request->user();
        $pengguna?->loadMissing('murid');

        if ($pengguna?->murid === null) {
            return null;
        }

        return app(TimService::class)->ringkasUntukMurid($attempt->kuis, $pengguna->murid);
    }

    /**
     * Id sesi dari server (dipakai presence untuk mendeteksi sesi ganda).
     */
    private function sesi(Request $request): ?string
    {
        return $request->hasSession() ? (string) $request->session()->getId() : null;
    }

    /**
     * Bungkus hasil attempt + rincian per soal (tanpa `additional()` agar tetap
     * tanpa pembungkus "data", sesuai kesepakatan API repo ini).
     */
    private function bungkusHasil(Attempt $attempt, AttemptService $service): AttemptHasilResource
    {
        $resource = new AttemptHasilResource($attempt);
        $resource->rincian = $service->rincianHasil($attempt);
        $resource->ringkasan = $service->ringkasanPenilaian($attempt);

        return $resource;
    }
}
