<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Pest configuration (tanpa test di sini — test ada di berkas *Test.php)
|--------------------------------------------------------------------------
*/

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class)->in('Feature');
