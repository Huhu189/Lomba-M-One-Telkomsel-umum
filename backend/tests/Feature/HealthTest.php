<?php

declare(strict_types=1);

it('health endpoint merespons 200 dengan struktur yang diharapkan', function () {
    $response = $this->getJson('/api/v1/health');

    $response->assertOk()
        ->assertJsonStructure(['ok', 'service', 'database', 'time'])
        ->assertJsonPath('ok', true)
        ->assertJsonPath('database', true);
});
