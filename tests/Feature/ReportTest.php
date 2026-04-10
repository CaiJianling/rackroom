<?php

use App\Models\User;

uses()->group('report');

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('reports page can be rendered', function () {
    $response = $this->get('/reports');
    $response->assertStatus(200);
});

test('report can be previewed via api', function () {
    $response = $this->postJson('/api/reports/preview', [
        'report_type' => 'inventory',
        'filters' => [],
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data',
            'total',
        ]);
});

test('chart data can be fetched via api', function () {
    $response = $this->postJson('/api/reports/chart-data', [
        'chart_type' => 'status_distribution',
        'filters' => [],
    ]);

    $response->assertStatus(200);
});

test('report template can be saved', function () {
    $response = $this->postJson('/api/reports/templates', [
        'name' => 'Test Template',
        'description' => 'Test Description',
        'report_type' => 'inventory',
        'filters' => [],
        'columns' => [],
        'is_shared' => false,
    ]);

    $response->assertStatus(201)
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('report_templates', [
        'name' => 'Test Template',
        'created_by' => $this->user->id,
    ]);
});
