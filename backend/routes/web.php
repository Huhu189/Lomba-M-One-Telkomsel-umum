<?php

declare(strict_types=1);

use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rute web
|--------------------------------------------------------------------------
|
| Backend ini API-only: seluruh antarmuka ada di aplikasi frontend (React/Vite).
| Root hanya mengarahkan ke sana supaya siapa pun yang membuka alamat backend
| tidak menemui halaman selamat datang bawaan Laravel (sisa scaffold).
|
*/

Route::get('/', function (): RedirectResponse {
    return redirect()->away(rtrim((string) config('app.frontend_url'), '/'));
});
