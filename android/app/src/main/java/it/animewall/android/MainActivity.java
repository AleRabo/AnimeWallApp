package it.animewall.android;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private static final String SITE_URL = "https://animewall-mvy7.onrender.com";
    private static final String RELEASES_URL =
            "https://api.github.com/repos/AleRabo/AnimeWallApp/releases?per_page=20";
    private static final int CURRENT_VERSION_CODE = 106;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private WebView webView;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        configureWebView();
        webView.loadUrl(SITE_URL);
        checkForUpdates();
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && uri.getHost() != null
                        && (uri.getHost().equals("animewall-mvy7.onrender.com")
                        || uri.getHost().endsWith("animeworld.ac"))) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    Toast.makeText(MainActivity.this, "Link non supportato", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                ((ViewGroup) webView.getParent()).addView(
                        view,
                        new ViewGroup.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                        )
                );
                webView.setVisibility(View.GONE);
                view.setVisibility(View.VISIBLE);
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
            }

            @Override
            public void onHideCustomView() {
                hideFullscreen();
            }
        });
    }

    private void hideFullscreen() {
        if (fullscreenView == null) return;
        ((ViewGroup) fullscreenView.getParent()).removeView(fullscreenView);
        fullscreenView = null;
        webView.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        if (fullscreenCallback != null) {
            fullscreenCallback.onCustomViewHidden();
            fullscreenCallback = null;
        }
    }

    private void checkForUpdates() {
        executor.execute(() -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(RELEASES_URL).openConnection();
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(8000);
                InputStream stream = connection.getInputStream();
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[4096];
                int count;
                while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
                byte[] bytes = output.toByteArray();
                JSONArray releases = new JSONArray(new String(bytes));
                for (int i = 0; i < releases.length(); i++) {
                    JSONObject release = releases.getJSONObject(i);
                    JSONArray assets = release.optJSONArray("assets");
                    if (assets == null) continue;
                    for (int j = 0; j < assets.length(); j++) {
                        JSONObject asset = assets.getJSONObject(j);
                        String name = asset.optString("name");
                        if (name.startsWith("AnimeWall-android-") && name.endsWith(".apk")) {
                            int versionCode = parseVersionCode(release.optString("tag_name"));
                            if (versionCode > CURRENT_VERSION_CODE) {
                                runOnUiThread(() -> showUpdateDialog(asset.optString("browser_download_url"), name));
                            }

                            return;
                        }
                    }
                }
            } catch (Exception ignored) {
                // An unavailable update service must not prevent the site from opening.
            }
        });
    }

    private int parseVersionCode(String tag) {
        try {
            String version = tag.replace("android-v", "");
            String[] parts = version.split("\\.");
            return Integer.parseInt(parts[0]) * 100
                    + Integer.parseInt(parts[1]) * 10
                    + Integer.parseInt(parts[2]);
        } catch (Exception ignored) {
            return CURRENT_VERSION_CODE;
        }
    }

    private void showUpdateDialog(String url, String fileName) {
        new AlertDialog.Builder(this)
                .setTitle("Aggiornamento AnimeWall disponibile")
                .setMessage("È disponibile una nuova versione dell'app Android.")
                .setNegativeButton("Più tardi", null)
                .setPositiveButton("Scarica", (dialog, which) -> downloadUpdate(url, fileName))
                .show();
    }

    private void downloadUpdate(String url, String fileName) {
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Aggiornamento AnimeWall");
        request.setDescription("Download nuova versione");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName);
        DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        manager.enqueue(request);
        Toast.makeText(this, "Download avviato. Apri la notifica per installare.", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            hideFullscreen();
            return;
        }
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        webView.destroy();
        super.onDestroy();
    }
}
