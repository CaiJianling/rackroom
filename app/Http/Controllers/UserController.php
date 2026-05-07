<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();
        $registrationEnabled = SystemSetting::get('registration_enabled', true);

        return inertia('User/Index', [
            'users' => $users,
            'registrationEnabled' => $registrationEnabled,
            'breadcrumbs' => [
                ['title' => __('navigation.userManagement'), 'href' => '/users'],
            ],
        ]);
    }

    public function create()
    {
        return inertia('User/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'is_active' => 'boolean',
            'is_admin' => 'boolean',
        ]);

        User::create($validated);

        return redirect()->route('users.index')->with('success', __('validation.created'));
    }

    public function edit(User $user)
    {
        return inertia('User/Edit', compact('user'));
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'password' => 'nullable|string|min:8',
            'is_active' => 'boolean',
            'is_admin' => 'boolean',
        ]);

        if ($user->id === Auth::id()) {
            unset($validated['is_active']);
        }

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $user->update($validated);

        return redirect()->route('users.index')->with('success', __('validation.updated'));
    }

    public function destroy(User $user)
    {
        $user->delete();

        return redirect()->route('users.index')->with('success', __('validation.deleted'));
    }

    public function toggleStatus(User $user)
    {
        if ($user->id === Auth::id()) {
            return redirect()->back()->withErrors(['error' => __('userManagement.cannotChangeOwnStatus')]);
        }

        $user->update(['is_active' => ! $user->is_active]);

        return redirect()->back()->with('success', __('validation.updated'));
    }
}
