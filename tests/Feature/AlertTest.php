<?php

use App\Models\Alert;
use App\Models\User;

uses()->group('alert');

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('alerts page can be rendered', function () {
    $response = $this->get('/alerts');
    $response->assertStatus(200);
});

test('alert can be created via api', function () {
    $response = $this->postJson('/api/alerts', [
        'title' => 'Test Alert',
        'description' => 'Test Description',
        'severity' => 'warning',
        'alert_type' => 'test_type',
        'resource_type' => 'device',
    ]);

    $response->assertStatus(201)
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('alerts', [
        'title' => 'Test Alert',
        'severity' => 'warning',
    ]);
});

test('alert can be acknowledged', function () {
    $alert = Alert::create([
        'title' => 'Test Alert',
        'severity' => 'warning',
        'alert_type' => 'test',
        'resource_type' => 'system',
        'status' => 'active',
        'triggered_at' => now(),
    ]);

    $response = $this->postJson("/api/alerts/{$alert->id}/acknowledge");

    $response->assertStatus(200)
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('alerts', [
        'id' => $alert->id,
        'status' => 'acknowledged',
    ]);
});

test('alert can be resolved', function () {
    $alert = Alert::create([
        'title' => 'Test Alert',
        'severity' => 'warning',
        'alert_type' => 'test',
        'resource_type' => 'system',
        'status' => 'active',
        'triggered_at' => now(),
    ]);

    $response = $this->postJson("/api/alerts/{$alert->id}/resolve", [
        'note' => 'Resolved for testing',
    ]);

    $response->assertStatus(200)
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('alerts', [
        'id' => $alert->id,
        'status' => 'resolved',
    ]);
});

test('alerts can be batch acknowledged', function () {
    $alerts = Alert::factory()->count(3)->create([
        'status' => 'active',
        'triggered_at' => now(),
    ]);

    $response = $this->postJson('/api/alerts/batch-acknowledge', [
        'ids' => $alerts->pluck('id')->toArray(),
    ]);

    $response->assertStatus(200)
        ->assertJson(['success' => true]);
});
