package it.animewall.android;

import android.content.pm.ActivityInfo;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/** Scheda nativa; solo il lettore di streaming è renderizzato in una WebView isolata. */
public class AnimeDetailActivity extends AppCompatActivity {
    public static final String EXTRA_ID = "anime_id";
    public static final String EXTRA_TITLE = "anime_title";
    public static final String EXTRA_IMAGE = "anime_image";

    private static final String SITE = "https://animewallita.netlify.app";
    private static final int BG = Color.rgb(8, 9, 12);
    private static final int PANEL = Color.rgb(21, 24, 34);
    private static final int ORANGE = Color.rgb(249, 115, 22);

    private FrameLayout outer;   // contiene la pagina e l'eventuale video a schermo intero
    private FrameLayout page;    // contenuto con i margini delle barre di sistema
    private WebView player;
    private ProgressBar progress;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private String animeId;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        animeId = getIntent().getStringExtra(EXTRA_ID);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        String image = getIntent().getStringExtra(EXTRA_IMAGE);

        outer = new FrameLayout(this);
        outer.setBackgroundColor(BG);
        page = new FrameLayout(this);
        outer.addView(page, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(outer);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
        ViewCompat.setOnApplyWindowInsetsListener(outer, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            page.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        showDetail(title == null || title.isEmpty() ? "Anime" : title, image);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (fullscreenView != null) hideFullscreen();
                else if (player != null && player.canGoBack()) player.goBack();
                else { setEnabled(false); getOnBackPressedDispatcher().onBackPressed(); }
            }
        });
    }

    // ------------------------------------------------------------------ scheda

    private void showDetail(String title, String image) {
        int width = getResources().getDisplayMetrics().widthPixels - dp(32);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(dp(16), dp(8), dp(16), dp(24));
        scroll.addView(column);

        FrameLayout head = new FrameLayout(this);
        head.setBackground(Ui.rounded(this, PANEL, 20));
        Ui.clip(head, 20);
        ImageView cover = new ImageView(this);
        cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
        head.addView(cover, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        ImageLoader.load(cover, image, width);
        View shade = new View(this);
        shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.argb(120, 8, 9, 12), Color.TRANSPARENT, Color.argb(230, 8, 9, 12)}));
        head.addView(shade, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        TextView back = text("←", 22, Color.WHITE, false);
        back.setGravity(Gravity.CENTER);
        back.setBackground(Ui.rounded(this, Color.argb(150, 8, 9, 12), 20));
        back.setOnClickListener(v -> getOnBackPressedDispatcher().onBackPressed());
        FrameLayout.LayoutParams backParams = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.TOP | Gravity.START);
        backParams.setMargins(dp(12), dp(12), 0, 0);
        head.addView(back, backParams);
        column.addView(head, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.round(width * 0.75f)));

        TextView name = text(title, 26, Color.WHITE, true);
        name.setPadding(0, dp(18), 0, 0);
        column.addView(name);

        TextView message = text("Scegli un episodio e guardalo nel lettore integrato. Il lettore resta separato dalla navigazione nativa dell'app.", 14, Color.LTGRAY, false);
        message.setLineSpacing(0, 1.15f);
        message.setPadding(0, dp(10), 0, dp(20));
        column.addView(message);

        TextView open = text("▶  Guarda episodi", 16, Color.BLACK, true);
        open.setGravity(Gravity.CENTER);
        open.setBackground(Ui.rounded(this, ORANGE, 16));
        open.setOnClickListener(v -> openPlayer());
        column.addView(open, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)));

        page.removeAllViews();
        page.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    // ------------------------------------------------------------------ lettore

    private void openPlayer() {
        if (player != null) return;
        player = new WebView(this);
        player.setBackgroundColor(BG);
        WebSettings settings = player.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(ColorStateList.valueOf(ORANGE));

        player.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                // Blocca intent:// market:// e simili usati da reindirizzamenti pubblicitari.
                return scheme == null || !(scheme.equals("https") || scheme.equals("http"));
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) { progress.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView view, String url) { progress.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(null,
                            "<html><body style='background:#08090c;color:#cbd5e1;font-family:sans-serif;padding:32px'>"
                                    + "<h3>Impossibile caricare la pagina</h3><p>Controlla la connessione e riprova.</p></body></html>",
                            "text/html", "utf-8", null);
                }
            }
        });
        player.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) { progress.setProgress(newProgress); }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view;
                fullscreenCallback = callback;
                outer.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                page.setVisibility(View.GONE);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                c.hide(WindowInsetsCompat.Type.systemBars());
            }
            @Override public void onHideCustomView() { hideFullscreen(); }
        });

        page.removeAllViews();
        page.addView(player, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        page.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP));
        player.loadUrl(SITE + "/anime/" + Uri.encode(animeId == null ? "" : animeId));
    }

    private void hideFullscreen() {
        if (fullscreenView == null) return;
        outer.removeView(fullscreenView);
        fullscreenView = null;
        page.setVisibility(View.VISIBLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).show(WindowInsetsCompat.Type.systemBars());
        if (fullscreenCallback != null) { fullscreenCallback.onCustomViewHidden(); fullscreenCallback = null; }
    }

    @Override protected void onPause() { if (player != null) player.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (player != null) player.onResume(); }

    @Override protected void onDestroy() {
        if (player != null) {
            ViewGroup parent = (ViewGroup) player.getParent();
            if (parent != null) parent.removeView(player);
            player.destroy();
            player = null;
        }
        super.onDestroy();
    }

    // ------------------------------------------------------------------ utilità

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private int dp(int value) { return Ui.dp(this, value); }
}