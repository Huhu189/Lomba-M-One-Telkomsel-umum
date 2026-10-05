<?php

declare(strict_types=1);

namespace App\Sections\School\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Sections\School\Http\Requests\SimpanSekolahRequest;
use App\Sections\School\Http\Resources\SekolahResource;
use App\Sections\School\Models\Sekolah;
use App\Sections\School\Services\SekolahService;

class SekolahController extends Controller
{
    public function show(SekolahService $sekolah): SekolahResource
    {
        $this->authorize('viewAny', Sekolah::class);

        return new SekolahResource($sekolah->tunggal());
    }

    public function update(SimpanSekolahRequest $request, SekolahService $sekolah): SekolahResource
    {
        $this->authorize('update', Sekolah::class);

        return new SekolahResource($sekolah->perbarui($request->validated()));
    }
}
