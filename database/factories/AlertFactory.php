<?php

namespace Database\Factories;

use App\Models\Alert;
use Illuminate\Database\Eloquent\Factories\Factory;

class AlertFactory extends Factory
{
    protected $model = Alert::class;

    public function definition(): array
    {
        return [
            'title' => $this->faker->sentence(3),
            'description' => $this->faker->paragraph(),
            'severity' => $this->faker->randomElement(['critical', 'warning', 'info']),
            'status' => 'active',
            'alert_type' => $this->faker->randomElement(['device_offline', 'high_temperature', 'disk_full']),
            'resource_type' => $this->faker->randomElement(['device', 'rack', 'room', 'system']),
            'resource_id' => null,
            'metadata' => null,
            'triggered_at' => now(),
        ];
    }
}
