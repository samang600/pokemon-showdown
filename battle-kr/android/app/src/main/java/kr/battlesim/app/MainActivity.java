package kr.battlesim.app;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.widget.FrameLayout;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** 한 장짜리 웹앱(assets/www/index.html)을 띄우는 화면 + 오프라인 데이터(그림·울음소리·애니메이션) 내려받기 */
public class MainActivity extends Activity {
    private WebView web;
    private volatile boolean downloading = false;

    /** 웹앱에서 쓰는 네이티브 기능 (window.BattleSimNative) */
    public class Native {
        /** 오프라인 데이터 상태: {"installed":true,"path":"/data/.../offline","bytes":12345,"parts":"sprites,cries,anims"} */
        @JavascriptInterface
        public String packStatus() {
            File dir = packDir();
            StringBuilder parts = new StringBuilder();
            long bytes = 0;
            for (String p : new String[]{"sprites", "cries", "anims"}) {
                File f = new File(dir, p + "/.done");
                if (f.exists()) { if (parts.length() > 0) parts.append(','); parts.append(p); bytes += dirSize(new File(dir, p)); }
            }
            return "{\"installed\":" + (parts.length() > 0) + ",\"path\":\"" + dir.getAbsolutePath().replace("\\", "\\\\").replace("\"", "\\\"")
                + "\",\"bytes\":" + bytes + ",\"parts\":\"" + parts + "\",\"downloading\":" + downloading + "}";
        }

        /** 묶음 zip 들을 받아 풀어 둔다. spec: "sprites=https://...zip;cries=https://...zip;anims=https://...zip" */
        @JavascriptInterface
        public void downloadPack(String spec) {
            if (downloading) return;
            downloading = true;
            new Thread(() -> {
                try {
                    for (String item : spec.split(";")) {
                        int eq = item.indexOf('=');
                        if (eq < 0) continue;
                        String name = item.substring(0, eq), url = item.substring(eq + 1);
                        File target = new File(packDir(), name);
                        if (new File(target, ".done").exists()) { progress(name, 1, 1, "done"); continue; }
                        deleteDir(target);
                        target.mkdirs();
                        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                        c.setConnectTimeout(20000); c.setReadTimeout(60000);
                        c.setInstanceFollowRedirects(true);
                        long total = c.getContentLengthLong();
                        long got = 0;
                        try (InputStream raw = new BufferedInputStream(c.getInputStream());
                             ZipInputStream zin = new ZipInputStream(new CountingStream(raw, n -> { }))) {
                            ZipEntry e;
                            byte[] buf = new byte[65536];
                            long lastReport = 0;
                            while ((e = zin.getNextEntry()) != null) {
                                File out = new File(target, e.getName());
                                if (!out.getCanonicalPath().startsWith(target.getCanonicalPath())) continue; // zip slip 방지
                                if (e.isDirectory()) { out.mkdirs(); continue; }
                                out.getParentFile().mkdirs();
                                try (FileOutputStream fo = new FileOutputStream(out)) {
                                    int n;
                                    while ((n = zin.read(buf)) > 0) { fo.write(buf, 0, n); got += n; }
                                }
                                if (System.currentTimeMillis() - lastReport > 300) { lastReport = System.currentTimeMillis(); progress(name, got, Math.max(total, got), "downloading"); }
                            }
                        }
                        new File(target, ".done").createNewFile();
                        progress(name, 1, 1, "done");
                    }
                    downloading = false;
                    progress("all", 1, 1, "done");
                } catch (Exception ex) {
                    downloading = false;
                    progress("all", 0, 1, "error:" + ex.getClass().getSimpleName() + " " + String.valueOf(ex.getMessage()).replace("\"", "'"));
                }
            }, "pack-download").start();
        }

        @JavascriptInterface
        public void deletePack() {
            if (downloading) return;
            deleteDir(packDir());
        }
    }

    interface Counter { void add(int n); }
    static class CountingStream extends java.io.FilterInputStream {
        final Counter c;
        CountingStream(InputStream in, Counter c) { super(in); this.c = c; }
        @Override public int read(byte[] b, int off, int len) throws java.io.IOException { int n = super.read(b, off, len); if (n > 0) c.add(n); return n; }
    }

    private File packDir() { return new File(getFilesDir(), "offline"); }

    private static long dirSize(File f) {
        if (f == null || !f.exists()) return 0;
        if (f.isFile()) return f.length();
        long s = 0; File[] list = f.listFiles();
        if (list != null) for (File c : list) s += dirSize(c);
        return s;
    }
    private static void deleteDir(File f) {
        if (f == null || !f.exists()) return;
        File[] list = f.listFiles();
        if (list != null) for (File c : list) deleteDir(c);
        f.delete();
    }
    private void progress(String name, long done, long total, String state) {
        final String js = "window.onPackProgress && window.onPackProgress({name:\"" + name + "\",done:" + done + ",total:" + total + ",state:\"" + state.replace("\"", "'") + "\"})";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 게임 중 화면이 꺼지지 않게
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true); // 내려받은 오프라인 데이터(files/offline)를 file:// 로 읽기 위해
        s.setAllowFileAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_DEFAULT); // 포켓몬 그림은 한 번 받으면 캐시에서 사용
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setBackgroundColor(0xFF12130F);
        web.addJavascriptInterface(new Native(), "BattleSimNative");
        // 상태 표시줄·내비게이션 바 영역은 앱 밖으로 (안드로이드 15 의 화면 끝까지 그리기 대응)
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF1C1D19);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets b = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(b.left, b.top, b.right, b.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("window.onAndroidPause && window.onAndroidPause()", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.onAndroidResume && window.onAndroidResume()", null);
    }

    @Override
    public void onBackPressed() {
        // 앱 안의 뒤로가기(모달 닫기·이전 화면)를 먼저 시도
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 'y' : 'n'", v -> {
            if (v == null || !v.contains("y")) MainActivity.super.onBackPressed();
        });
    }
}
