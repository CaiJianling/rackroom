<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SshOutputEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $sessionId;

    public string $output;

    public string $type;

    public function __construct(string $sessionId, string $output, string $type = 'output')
    {
        $this->sessionId = $sessionId;
        $this->output = $output;
        $this->type = $type;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('ssh.'.$this->sessionId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'ssh.output';
    }
}
