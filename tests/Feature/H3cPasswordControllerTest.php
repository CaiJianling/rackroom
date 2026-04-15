<?php

use App\Models\H3cPasswordChangeLog;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create(['email_verified_at' => now()]);
});

describe('H3C Password Controller', function () {
    test('page requires authentication', function () {
        $response = $this->get(route('tools.h3c-password.index'));
        $response->assertRedirect('/login');
    });

    test('authenticated user can access page', function () {
        $response = $this->actingAs($this->user)
            ->followingRedirects()
            ->get(route('tools.h3c-password.index'));

        $response->assertOk();
    });

    test('template download requires authentication', function () {
        $response = $this->get(route('tools.h3c-password.template'));
        $response->assertRedirect('/login');
    });

    test('authenticated user can download template', function () {
        $response = $this->actingAs($this->user)
            ->followingRedirects()
            ->get(route('tools.h3c-password.template'));

        $response->assertOk();
    });

    test('upload requires authentication', function () {
        $response = $this->postJson(route('tools.h3c-password.upload'), []);
        $response->assertUnauthorized();
    });

    test('execute requires authentication', function () {
        $response = $this->postJson(route('tools.h3c-password.execute'), [
            'switches' => [],
        ]);
        $response->assertUnauthorized();
    });

    test('logs requires authentication', function () {
        $response = $this->getJson(route('tools.h3c-password.logs'));
        $response->assertUnauthorized();
    });

    test('authenticated user can view logs', function () {
        H3cPasswordChangeLog::factory()->count(5)->create(['user_id' => $this->user->id]);

        $response = $this->withoutMiddleware(['verified'])
            ->actingAs($this->user)
            ->getJson(route('tools.h3c-password.logs'));

        $response->assertOk();
        $response->assertJsonPath('success', true);
    });

    test('logs are created in database', function () {
        $log = H3cPasswordChangeLog::factory()->create([
            'ip_address' => '192.168.1.1',
            'port' => 22,
            'username' => 'admin',
            'status' => '成功',
            'message' => '密码修改成功',
        ]);

        $this->assertDatabaseHas('h3c_password_change_logs', [
            'ip_address' => '192.168.1.1',
            'username' => 'admin',
            'status' => '成功',
        ]);
    });
});
