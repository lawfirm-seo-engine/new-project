using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace GNLAW.SmartEditor
{
    public sealed class MainForm : Form
    {
        private readonly Button loginButton = new Button();
        private readonly Button loginDoneButton = new Button();
        private readonly Button startButton = new Button();
        private readonly Button stopButton = new Button();
        private readonly Button adminButton = new Button();
        private readonly TextBox logBox = new TextBox();
        private readonly Label statusLabel = new Label();
        private Process runner;

        public MainForm()
        {
            Text = "법무법인 선린 · 카페 원고·릴스 자동화";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(760, 520);
            Size = new Size(860, 600);
            Font = new Font("Malgun Gothic", 10F);
            BackColor = Color.FromArgb(244, 246, 251);

            var title = new Label {
                Text = "GNLAW SmartEditor 자동화",
                Font = new Font("Malgun Gothic", 18F, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(24, 20)
            };
            var description = new Label {
                Text = "릴스 영상 생성·Instagram 게시·네이버 카페 원고/이미지/영상 게시를 순차 처리합니다.",
                AutoSize = true,
                ForeColor = Color.FromArgb(70, 82, 105),
                Location = new Point(28, 60)
            };

            ConfigureButton(loginButton, "1. 최초 로그인", 28, 98, 150, Color.FromArgb(38, 50, 68));
            ConfigureButton(loginDoneButton, "로그인 확인 완료", 188, 98, 150, Color.FromArgb(71, 85, 105));
            ConfigureButton(startButton, "2. 자동화 시작", 348, 98, 150, Color.FromArgb(3, 168, 86));
            ConfigureButton(stopButton, "중지", 508, 98, 100, Color.FromArgb(140, 29, 24));
            ConfigureButton(adminButton, "관리자 화면", 618, 98, 150, Color.FromArgb(31, 79, 216));

            loginDoneButton.Enabled = false;
            stopButton.Enabled = false;
            loginButton.Click += (sender, args) => StartRunner("login", true);
            loginDoneButton.Click += (sender, args) => SendLoginConfirmation();
            startButton.Click += (sender, args) => StartRunner("watch --publish --yes", false);
            stopButton.Click += (sender, args) => StopRunner();
            adminButton.Click += (sender, args) => Process.Start(new ProcessStartInfo("https://gnlaw-criminal.co.kr/admin/cafe-reels") { UseShellExecute = true });

            statusLabel.Text = "대기 중";
            statusLabel.AutoSize = true;
            statusLabel.Font = new Font("Malgun Gothic", 10F, FontStyle.Bold);
            statusLabel.ForeColor = Color.FromArgb(31, 79, 216);
            statusLabel.Location = new Point(28, 148);

            logBox.Location = new Point(28, 180);
            logBox.Size = new Size(792, 340);
            logBox.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            logBox.Multiline = true;
            logBox.ReadOnly = true;
            logBox.ScrollBars = ScrollBars.Vertical;
            logBox.BackColor = Color.White;
            logBox.Font = new Font("Consolas", 9.5F);

            Controls.AddRange(new Control[] { title, description, loginButton, loginDoneButton, startButton, stopButton, adminButton, statusLabel, logBox });
            FormClosing += (sender, args) => StopRunner();
        }

        private static void ConfigureButton(Button button, string text, int x, int y, int width, Color color)
        {
            button.Text = text;
            button.Location = new Point(x, y);
            button.Size = new Size(width, 38);
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0;
            button.BackColor = color;
            button.ForeColor = Color.White;
            button.Font = new Font("Malgun Gothic", 9.5F, FontStyle.Bold);
        }

        private void StartRunner(string arguments, bool loginMode)
        {
            if (runner != null && !runner.HasExited) {
                MessageBox.Show("이미 프로그램이 실행 중입니다. 먼저 중지해주세요.", "GNLAW SmartEditor");
                return;
            }
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            var nodePath = Path.Combine(baseDir, "runtime", "node.exe");
            var cliPath = Path.Combine(baseDir, "cli.mjs");
            if (!File.Exists(nodePath) || !File.Exists(cliPath)) {
                MessageBox.Show("프로그램 파일이 완전하지 않습니다. Install.cmd를 다시 실행해주세요.", "설치 확인", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            logBox.Clear();
            AppendLog(loginMode
                ? "Chrome이 열리면 네이버와 관리자 로그인을 완료한 뒤 '로그인 확인 완료'를 누르세요."
                : "전체 자동화 대기열 감시를 시작합니다. 이 창은 켜두세요.");
            statusLabel.Text = loginMode ? "로그인 대기 중" : "자동화 실행 중";
            loginDoneButton.Enabled = loginMode;

            var info = new ProcessStartInfo {
                FileName = nodePath,
                Arguments = "\"" + cliPath + "\" " + arguments,
                WorkingDirectory = baseDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                RedirectStandardInput = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            };
            runner = new Process { StartInfo = info, EnableRaisingEvents = true };
            runner.OutputDataReceived += (sender, args) => { if (args.Data != null) AppendLog(args.Data); };
            runner.ErrorDataReceived += (sender, args) => { if (args.Data != null) AppendLog("오류: " + args.Data); };
            runner.Exited += (sender, args) => BeginInvoke((Action)(() => {
                statusLabel.Text = runner.ExitCode == 0 ? "작업 종료" : "오류로 종료됨";
                loginDoneButton.Enabled = false;
                stopButton.Enabled = false;
                loginButton.Enabled = true;
                startButton.Enabled = true;
            }));
            runner.Start();
            runner.BeginOutputReadLine();
            runner.BeginErrorReadLine();
            stopButton.Enabled = true;
            loginButton.Enabled = false;
            startButton.Enabled = false;
        }

        private void SendLoginConfirmation()
        {
            if (runner == null || runner.HasExited) return;
            runner.StandardInput.WriteLine();
            runner.StandardInput.Flush();
            loginDoneButton.Enabled = false;
            statusLabel.Text = "로그인 상태 확인 중";
        }

        private void StopRunner()
        {
            try {
                if (runner != null && !runner.HasExited) runner.Kill();
            } catch { }
            loginDoneButton.Enabled = false;
            stopButton.Enabled = false;
            loginButton.Enabled = true;
            startButton.Enabled = true;
            statusLabel.Text = "중지됨";
        }

        private void AppendLog(string text)
        {
            if (InvokeRequired) { BeginInvoke((Action<string>)AppendLog, text); return; }
            logBox.AppendText("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + text + Environment.NewLine);
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
