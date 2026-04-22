<?php

namespace Tests\Feature;

use App\Http\Controllers\SshTerminalController;
use App\Models\User;
use App\Services\SshSessionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class SshTerminalTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'is_admin' => true,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($this->user);
    }

    public function test_ssh_terminal_controller_exists_and_has_required_methods(): void
    {
        $controller = new SshTerminalController(
            new SshSessionService
        );

        $this->assertInstanceOf(SshTerminalController::class, $controller, 'Controller should be instance of SshTerminalController');
        $this->assertTrue(method_exists($controller, 'index'), 'Controller should have index method');
        $this->assertTrue(method_exists($controller, 'connect'), 'Controller should have connect method');
        $this->assertTrue(method_exists($controller, 'execute'), 'Controller should have execute method');
        $this->assertTrue(method_exists($controller, 'getOutput'), 'Controller should have getOutput method');
        $this->assertTrue(method_exists($controller, 'disconnect'), 'Controller should have disconnect method');
        $this->assertTrue(method_exists($controller, 'sessionInfo'), 'Controller should have sessionInfo method');
    }

    public function test_ssh_session_service_can_be_instantiated(): void
    {
        $service = new SshSessionService;

        $this->assertInstanceOf(SshSessionService::class, $service, 'Service should be instance of SshSessionService');
    }

    public function test_ssh_terminal_routes_are_registered(): void
    {
        $routes = \Illuminate\Support\Facades\Route::getRoutes();

        $indexRoute = collect($routes)->first(fn ($route) => $route->getName() === 'tools.ssh-terminal.index');
        $connectRoute = collect($routes)->first(fn ($route) => $route->getName() === 'tools.ssh-terminal.connect');
        $executeRoute = collect($routes)->first(fn ($route) => $route->getName() === 'tools.ssh-terminal.execute');
        $outputRoute = collect($routes)->first(fn ($route) => $route->getName() === 'tools.ssh-terminal.output');
        $disconnectRoute = collect($routes)->first(fn ($route) => $route->getName() === 'tools.ssh-terminal.disconnect');

        $this->assertNotNull($indexRoute);
        $this->assertNotNull($connectRoute);
        $this->assertNotNull($executeRoute);
        $this->assertNotNull($outputRoute);
        $this->assertNotNull($disconnectRoute);
    }

    public function test_ssh_endpoints_require_authentication(): void
    {
        // 先登出当前用户
        $this->app['auth']->logout();

        /** @var TestResponse $response */

        // 测试连接端点
        $response = $this->postJson('/tools/ssh-terminal/connect', [
            'host' => '192.168.1.100',
            'port' => 22,
            'username' => 'root',
            'password' => 'password',
        ]);
        $response->assertUnauthorized();

        // 测试执行端点
        $response = $this->postJson('/tools/ssh-terminal/execute', [
            'sessionId' => 'test-session',
            'command' => 'ls',
        ]);
        $response->assertUnauthorized();

        // 测试输出端点
        $response = $this->getJson('/tools/ssh-terminal/output?sessionId=test');
        $response->assertUnauthorized();

        // 测试断开端点
        $response = $this->postJson('/tools/ssh-terminal/disconnect', [
            'sessionId' => 'test-session',
        ]);
        $response->assertUnauthorized();
    }
}
