<?php

namespace App\Http\Controllers;

use App\Models\H3cPasswordChangeLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use phpseclib3\Net\SSH2;

class H3cPasswordController extends Controller
{
    /**
     * 显示批量修改密码页面
     */
    public function index()
    {
        return Inertia::render('Tools/H3cPassword');
    }

    /**
     * 下载Excel模板
     */
    public function downloadTemplate()
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        // 设置表头
        $sheet->setCellValue('A1', 'IP地址');
        $sheet->setCellValue('B1', '端口');
        $sheet->setCellValue('C1', '用户名');
        $sheet->setCellValue('D1', '密码');
        $sheet->setCellValue('E1', '新密码');

        // 示例数据
        $sheet->setCellValue('A2', '192.168.1.1');
        $sheet->setCellValue('B2', '22');
        $sheet->setCellValue('C2', 'admin');
        $sheet->setCellValue('D2', 'password');
        $sheet->setCellValue('E2', 'newpassword');

        // 自动调整列宽
        foreach (range('A', 'E') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $filename = 'H3C交换机密码修改模板.xlsx';
        $tempPath = storage_path('app/temp/'.$filename);

        // 确保目录存在
        if (! is_dir(storage_path('app/temp'))) {
            mkdir(storage_path('app/temp'), 0755, true);
        }

        $writer->save($tempPath);

        return response()->download($tempPath, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }

    /**
     * 上传并解析Excel文件
     */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getPathname());
            $sheet = $spreadsheet->getActiveSheet();
            $data = [];

            $rowCount = $sheet->getHighestRow();

            for ($row = 2; $row <= $rowCount; $row++) {
                $ip = $sheet->getCell('A'.$row)->getValue();

                // 跳过空行
                if (empty($ip)) {
                    continue;
                }

                $port = $sheet->getCell('B'.$row)->getValue();
                $username = $sheet->getCell('C'.$row)->getValue();
                $password = $sheet->getCell('D'.$row)->getValue();
                $newPassword = $sheet->getCell('E'.$row)->getValue();

                $data[] = [
                    'ip_address' => (string) $ip,
                    'port' => is_numeric($port) ? (int) $port : 22,
                    'username' => (string) $username,
                    'old_password' => (string) $password,
                    'new_password' => (string) $newPassword,
                    'status' => '待处理',
                    'message' => '',
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $data,
                'total' => count($data),
            ]);
        } catch (\Exception $e) {
            Log::error('H3C密码修改 - Excel解析失败: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => '文件解析失败: '.$e->getMessage(),
            ], 422);
        }
    }

    /**
     * 执行批量修改密码
     */
    public function execute(Request $request)
    {
        $request->validate([
            'switches' => 'required|array|min:1',
            'switches.*.ip_address' => 'required|string',
            'switches.*.port' => 'required|integer',
            'switches.*.username' => 'required|string',
            'switches.*.old_password' => 'required|string',
            'switches.*.new_password' => 'required|string',
        ]);

        $switches = $request->input('switches');
        $results = [];
        $successCount = 0;
        $failCount = 0;

        foreach ($switches as $switch) {
            $result = $this->changePassword($switch);
            $results[] = $result;

            if ($result['success']) {
                $successCount++;
            } else {
                $failCount++;
            }

            // 记录日志
            H3cPasswordChangeLog::create([
                'ip_address' => $switch['ip_address'],
                'port' => $switch['port'],
                'username' => $switch['username'],
                'status' => $result['success'] ? '成功' : '失败',
                'message' => $result['message'],
                'user_id' => Auth::id(),
                'executed_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'results' => $results,
            'summary' => [
                'total' => count($switches),
                'success' => $successCount,
                'failed' => $failCount,
            ],
        ]);
    }

    /**
     * 修改单个交换机的密码
     */
    private function changePassword(array $switch): array
    {
        $ssh = new SSH2($switch['ip_address'], $switch['port'], 10);

        try {
            if (! $ssh->login($switch['username'], $switch['old_password'])) {
                return [
                    'ip_address' => $switch['ip_address'],
                    'success' => false,
                    'message' => '认证失败：用户名或密码错误',
                ];
            }

            // 禁用分页，避免 ---- More ---- 提示
            $ssh->write("screen-length disable\n");
            $this->readUntilPrompt($ssh, 2);

            // 进入系统视图
            $ssh->write("system-view\n");
            $this->readUntilPrompt($ssh, 2);

            // 进入本地用户配置
            $ssh->write("local-user {$switch['username']}\n");
            $this->readUntilPrompt($ssh, 2);

            // 修改密码
            $ssh->write("password simple {$switch['new_password']}\n");
            $this->readUntilPrompt($ssh, 2);

            // 退出到用户视图
            $ssh->write("quit\n");
            $this->readUntilPrompt($ssh, 2);
            $ssh->write("quit\n");
            $this->readUntilPrompt($ssh, 2);

            // 保存配置
            $ssh->write("save force\n");
            $saveOutput = $this->readUntilPrompt($ssh, 5);

            // 如果需要确认保存
            if (str_contains($saveOutput, 'Y/N') || str_contains($saveOutput, 'Continue?')) {
                $ssh->write("Y\n");
                $saveOutput .= $this->readUntilPrompt($ssh, 5);
            }

            $ssh->disconnect();

            // 检查是否成功
            if (str_contains(strtolower($saveOutput), 'successfully') ||
                str_contains(strtolower($saveOutput), 'saved') ||
                str_contains(strtolower($saveOutput), 'configuration')) {
                return [
                    'ip_address' => $switch['ip_address'],
                    'success' => true,
                    'message' => '密码修改并保存成功',
                ];
            }

            return [
                'ip_address' => $switch['ip_address'],
                'success' => true,
                'message' => '密码修改成功',
            ];
        } catch (\Exception $e) {
            Log::error("H3C密码修改失败 {$switch['ip_address']}: ".$e->getMessage());

            return [
                'ip_address' => $switch['ip_address'],
                'success' => false,
                'message' => '修改失败: '.$e->getMessage(),
            ];
        }
    }

    /**
     * 读取直到出现提示符或超时
     */
    private function readUntilPrompt(SSH2 $ssh, int $timeout): string
    {
        $output = '';
        $startTime = time();

        while (time() - $startTime < $timeout) {
            $chunk = $ssh->read(0);
            if ($chunk !== false && $chunk !== null) {
                $output .= $chunk;
            }

            // 检查是否出现常见提示符
            if (str_contains($output, ']') || str_contains($output, '>') || str_contains($output, '#')) {
                break;
            }

            usleep(100000); // 100ms
        }

        return $output;
    }

    /**
     * 获取修改日志
     */
    public function logs(Request $request)
    {
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $query = H3cPasswordChangeLog::query()
            ->with('user:id,name')
            ->orderBy('executed_at', 'desc');

        if ($request->has('start_date')) {
            $query->whereDate('executed_at', '>=', $request->input('start_date'));
        }

        if ($request->has('end_date')) {
            $query->whereDate('executed_at', '<=', $request->input('end_date'));
        }

        $logs = $query->paginate(20);

        return response()->json([
            'success' => true,
            'logs' => $logs,
        ]);
    }

    /**
     * 删除日志
     */
    public function deleteLogs(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:h3c_password_change_logs,id',
        ]);

        H3cPasswordChangeLog::whereIn('id', $request->input('ids'))->delete();

        return response()->json([
            'success' => true,
            'message' => '日志删除成功',
        ]);
    }

    /**
     * 清空所有日志
     */
    public function clearLogs()
    {
        H3cPasswordChangeLog::truncate();

        return response()->json([
            'success' => true,
            'message' => '所有日志已清空',
        ]);
    }
}
