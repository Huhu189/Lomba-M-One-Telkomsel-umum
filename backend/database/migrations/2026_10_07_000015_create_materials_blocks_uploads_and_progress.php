<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Materi pelajaran + unggahan berpotongan + progres murid (slice 08).
 *
 * Beberapa keputusan yang disengaja:
 *
 * - Materi adalah **urutan blok** (`material_blocks`), bukan satu badan teks.
 *   Blok berjenis `kuis` hanya menunjuk kuis yang sudah ada di bank soal
 *   (`quiz_id`), jadi tidak ada tipe soal atau penilai baru di sini.
 * - Berkas disimpan per potongan (`material_upload_chunks`) dan baru digabung
 *   saat klien menyatakan selesai; berkas yatim yang tidak pernah digabung
 *   dibersihkan penjadwal. Tanpa pemisahan ini, unggahan yang gagal di tengah
 *   jalan akan menumpuk di storage selamanya.
 * - Kategori berkas hasil klasifikasi magic bytes disimpan di baris unggahan
 *   (`kategori`), bukan dihitung ulang saat penyajian: penyajian tidak boleh
 *   membuka berkas hanya untuk memutuskan cara mengirimkannya.
 * - Progres dihitung per blok per murid dengan kunci unik, jadi murid yang
 *   membuka ulang blok tidak menggandakan baris dan server bisa menolak lompat
 *   blok wajib hanya dengan membaca tabel ini.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materials', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained('subjects')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            // Tema pemahaman materi = tag yang sama dengan tag soal.
            $table->foreignId('tag_id')->nullable()->constrained('tags')->nullOnDelete();
            $table->string('judul', 150);
            $table->text('deskripsi')->nullable();
            $table->string('status', 20)->default('draf');
            $table->unsignedSmallInteger('urutan')->default(0);
            $table->dateTime('publikasi_at')->nullable();
            $table->foreignId('dibuat_oleh')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['school_id', 'status']);
            $table->index(['class_id', 'status']);
        });

        Schema::create('material_blocks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->unsignedSmallInteger('urutan');
            // teks | media | kuis — divalidasi enum di server.
            $table->string('tipe', 20);
            // Blok wajib harus dituntaskan sebelum blok berikutnya dibuka.
            $table->boolean('wajib')->default(true);
            // Isi teks/media, atau penunjukan kuis untuk blok kuis.
            $table->json('isi')->nullable();
            $table->foreignId('quiz_id')->nullable()->constrained('quizzes')->nullOnDelete();
            $table->timestamps();

            $table->unique(['material_id', 'urutan']);
        });

        Schema::create('material_uploads', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            // Materi tujuan boleh kosong: berkas diunggah dulu, ditempelkan ke blok kemudian.
            $table->foreignId('material_id')->nullable()->constrained('materials')->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Penanda publik unik untuk URL bertanda tangan (id internal tidak dipakai).
            $table->string('kode', 40)->unique();
            $table->string('nama_asli', 255);
            $table->string('nama_simpan', 255)->nullable();
            // Hasil klasifikasi magic bytes; kategori inilah yang menentukan cara penyajian.
            $table->string('ekstensi', 12);
            $table->string('mime', 120);
            $table->string('kategori', 20);
            $table->unsignedBigInteger('ukuran_total');
            $table->unsignedSmallInteger('jumlah_potongan');
            $table->string('hash', 64)->nullable();
            $table->string('status', 20)->default('menunggu');
            $table->string('path', 255)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'status']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('material_upload_chunks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('upload_id')->constrained('material_uploads')->cascadeOnDelete();
            $table->unsignedSmallInteger('indeks');
            $table->unsignedInteger('ukuran');
            $table->string('hash', 64);
            $table->string('path', 255);
            $table->timestamps();

            // Kunci unik ini yang membuat kiriman ulang potongan idempoten.
            $table->unique(['upload_id', 'indeks']);
        });

        Schema::create('material_progress', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('school_id')->constrained('schools')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->foreignId('block_id')->constrained('material_blocks')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            // Attempt kuis sisipan (jenis latihan) bila blok ini blok kuis.
            $table->foreignId('attempt_id')->nullable()->constrained('attempts')->nullOnDelete();
            $table->string('status', 20)->default('dibuka');
            $table->decimal('skor', 8, 2)->default(0);
            $table->timestamp('selesai_at')->nullable();
            $table->timestamps();

            $table->unique(['block_id', 'student_id']);
            $table->index(['material_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_progress');
        Schema::dropIfExists('material_upload_chunks');
        Schema::dropIfExists('material_uploads');
        Schema::dropIfExists('material_blocks');
        Schema::dropIfExists('materials');
    }
};
