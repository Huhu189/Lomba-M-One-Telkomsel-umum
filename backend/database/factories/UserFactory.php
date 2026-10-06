<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use App\Sections\Auth\Enums\UserStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Password dipakai bersama di test (kolom di-cast hashed).
     */
    protected static ?string $password = null;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => null,
            'password' => static::$password ??= Hash::make('password-aman-123', ['memory_cost' => 1024]),
            'status' => UserStatus::Pending->value,
            'role' => 'murid',
        ];
    }

    /**
     * Kolom `role` dan role Spatie selalu sinkron pada data uji (lihat User::tetapkanPeran),
     * sehingga setiap state di bawah cukup mengubah kolomnya saja.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (User $user): void {
            $user->tetapkanPeran((string) $user->role);
        });
    }

    /** Murid aktif + terverifikasi (siap login). */
    public function muridAktif(): static
    {
        return $this->state(fn () => [
            'email_verified_at' => now(),
            'status' => UserStatus::Aktif->value,
        ]);
    }

    /** Guru aktif (akun guru hanya dari seeder/impor). */
    public function guru(): static
    {
        return $this->state(fn () => [
            'email_verified_at' => now(),
            'status' => UserStatus::Aktif->value,
            'role' => 'guru',
        ]);
    }

    /** Akun ditangguhkan (untuk test blokir). */
    public function suspended(): static
    {
        return $this->state(fn () => [
            'email_verified_at' => now(),
            'status' => UserStatus::Suspended->value,
        ]);
    }
}
