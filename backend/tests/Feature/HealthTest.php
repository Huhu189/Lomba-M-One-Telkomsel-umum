<?php

declare(strict_types=1);

it('health endpoint merespons 200 dengan struktur yang diharapkan', function () {
    $response = $this->getJson('/api/v1/health');

    $response->assertOk()
        ->assertJsonStructure(['ok', 'service', 'database', 'time'])
        ->assertJsonPath('ok', true)
        ->assertJsonPath('database', true);
});

it('root backend mengarahkan ke aplikasi frontend (bukan halaman selamat datang bawaan)', function () {
    $frontend = rtrim((string) config('app.frontend_url'), '/');

    expect($frontend)->not->toBe('');

    $this->get('/')->assertRedirect($frontend);
});
