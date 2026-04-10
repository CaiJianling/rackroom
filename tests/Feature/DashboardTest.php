<?php

use App\Models\User;

uses()->group('dashboard');

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('dashboard page can be rendered', function () {
    $response = $this->get('/dashboard');
    $response->assertStatus(200);
});

test('dashboard returns correct stats structure', function () {
    $response = $this->get('/dashboard');
    $response->assertStatus(200)
        ->assertInertia(fn ($page) => $page
            ->has('stats.rooms')
            ->has('stats.racks')
            ->has('stats.devices')
            ->has('stats.alerts')
            ->has('stats.power')
            ->has('deviceStatusDistribution')
            ->has('roomDistribution')
            ->has('recentAlerts')
            ->has('recentDevices')
            ->has('categoryDistribution')
        );
});
