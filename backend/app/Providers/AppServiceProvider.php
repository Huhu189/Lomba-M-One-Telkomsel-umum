<?php

declare(strict_types=1);

namespace App\Providers;

use App\Sections\Question\Models\Soal;
use App\Sections\Question\Models\Tag;
use App\Sections\Question\Policies\SoalPolicy;
use App\Sections\Question\Policies\TagPolicy;
use App\Sections\Quiz\Models\Kuis;
use App\Sections\Quiz\Policies\KuisPolicy;
use App\Sections\School\Models\Kelas;
use App\Sections\School\Models\Mapel;
use App\Sections\School\Models\Murid;
use App\Sections\School\Models\Sekolah;
use App\Sections\School\Policies\KelasPolicy;
use App\Sections\School\Policies\MapelPolicy;
use App\Sections\School\Policies\MuridPolicy;
use App\Sections\School\Policies\SekolahPolicy;
use App\Sections\Settings\Models\Pengaturan;
use App\Sections\Settings\Policies\PengaturanPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Pagar mutu: model ketat di semua lingkungan non-produksi.
        Model::shouldBeStrict(! $this->app->isProduction());
        Model::preventLazyLoading(! $this->app->isProduction());

        // Respons resource tanpa pembungkus "data" (skema flat untuk klien).
        JsonResource::withoutWrapping();

        // Policy model berada di luar App\Models, jadi didaftarkan eksplisit.
        Gate::policy(Sekolah::class, SekolahPolicy::class);
        Gate::policy(Kelas::class, KelasPolicy::class);
        Gate::policy(Mapel::class, MapelPolicy::class);
        Gate::policy(Murid::class, MuridPolicy::class);
        Gate::policy(Pengaturan::class, PengaturanPolicy::class);
        Gate::policy(Tag::class, TagPolicy::class);
        Gate::policy(Soal::class, SoalPolicy::class);
        Gate::policy(Kuis::class, KuisPolicy::class);

        // Throttle jalur auth (chunk security: anti brute-force & anti spam email).
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip().'|'.mb_strtolower((string) $request->input('email')));
        });

        RateLimiter::for('verifikasi', function (Request $request) {
            return Limit::perMinute(3)->by($request->ip());
        });
    }
}
