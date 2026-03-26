<?php
/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-02-25 00:31:13
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-26 12:08:47
 * @FilePath: /godlytools/app/Http/Controllers/UserController.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserController extends Controller
{
    public function index()
    {
        $users = User::all();
        return inertia('User/Index', compact('users'));
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

        return redirect()->route('users.index');
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

        return redirect()->route('users.index');
    }

    public function destroy(User $user)
    {
        $user->delete();
        return redirect()->route('users.index');
    }

    public function toggleStatus(User $user)
    {
        if ($user->id === Auth::id()) {
            return redirect()->back()->withErrors(['error' => __('userManagement.cannotChangeOwnStatus')]);
        }

        $user->update(['is_active' => !$user->is_active]);
        return redirect()->back();
    }
}
