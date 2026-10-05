<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
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

        // Throttle jalur auth (chunk security: anti brute-force & anti spam email).
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip().'|'.mb_strtolower((string) $request->input('email')));
        });

        RateLimiter::for('verifikasi', function (Request $request) {
            return Limit::perMinute(3)->by($request->ip());
        });
    }
}
