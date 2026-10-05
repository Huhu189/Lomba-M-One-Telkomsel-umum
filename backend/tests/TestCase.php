<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Hashing cepat khusus test: impor CSV 500 baris butuh banyak hash.
        // Produksi tetap memakai Argon2id (HASH_DRIVER=argon2id di .env).
        config([
            'hashing.driver' => 'bcrypt',
            'hashing.bcrypt.rounds' => 4,
        ]);
    }
}
