<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        // 检查是否允许注册（第一个用户总是可以注册）
        $isFirstUser = User::count() === 0;
        $registrationEnabled = SystemSetting::get('registration_enabled', true);

        if (! $isFirstUser && ! $registrationEnabled) {
            throw ValidationException::withMessages([
                'email' => [__('auth.registration_disabled')],
            ]);
        }

        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ])->validate();

        return User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
            'is_admin' => $isFirstUser,
        ]);
    }
}
