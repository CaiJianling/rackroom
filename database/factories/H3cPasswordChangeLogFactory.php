<?php

namespace Database\Factories;

use App\Models\H3cPasswordChangeLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<H3cPasswordChangeLog>
 */
class H3cPasswordChangeLogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'ip_address' => $this->faker->ipv4,
            'port' => 22,
            'username' => $this->faker->userName,
            'status' => $this->faker->randomElement(['成功', '失败']),
            'message' => $this->faker->sentence,
            'user_id' => User::factory(),
            'executed_at' => now(),
        ];
    }
}
