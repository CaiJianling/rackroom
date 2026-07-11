<?php

use App\Models\User;

uses()->group('monitor');

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('monitor page can be rendered', function () {
    $response = $this->get('/monitor');
    $response->assertStatus(200);
});

test('monitor stats api returns data', function () {
    $response = $this->getJson('/api/monitor/stats');
    $response->assertStatus(200)
        ->assertJsonStructure([
            'rooms',
            'racks',
            'devices',
            'alerts',
            'timestamp',
        ]);
});

test('monitor devices api returns data', function () {
    $response = $this->getJson('/api/monitor/devices');
    $response->assertStatus(200);
});

test('monitor alert stats api returns data', function () {
    $response = $this->getJson('/api/monitor/alert-stats');
    $response->assertStatus(200)
        ->assertJsonStructure([
            'critical',
            'warning',
            'info',
            'total_active',
            'today',
        ]);
});
