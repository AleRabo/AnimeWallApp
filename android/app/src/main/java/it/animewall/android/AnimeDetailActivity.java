package it.animewall.android;

import android.graphics.Color;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/** Native detail view; only the streaming player is rendered in an isolated WebView. */
public class AnimeDetailActivity extends AppCompatActivity {
    public static final String EXTRA_ID = "anime_id";
    public static final String EXTRA_TITLE = "anime_title";
    private WebView player;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        String id = getIntent().getStringExtra(EXTRA_ID);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(20));
        root.setBackgroundColor(Color.rgb(8, 9, 12));
        TextView name = new TextView(this);
        name.setText(title == null || title.isEmpty() ? "Anime" : title);
        name.setTextSize(26); name.setTextColor(Color.WHITE); name.setTypeface(null, 1);
        root.addView(name);
        TextView message = new TextView(this);
        message.setText("Apri la scheda per scegliere un episodio. Il lettore resta separato dalla navigazione nativa dell'app.");
        message.setTextSize(15); message.setTextColor(Color.LTGRAY); message.setPadding(0, dp(14), 0, dp(18));
        root.addView(message);
        Button open = new Button(this);
        open.setText("Apri episodi e lettore"); open.setTextColor(Color.BLACK); open.setBackgroundColor(Color.rgb(249, 115, 22));
        open.setOnClickListener(v -> openPlayer(id));
        root.addView(open, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)));
        setContentView(root);
    }

    private void openPlayer(String id) {
        player = new WebView(this);
        WebSettings settings = player.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setMediaPlaybackRequiresUserGesture(false);
        player.setWebViewClient(new WebViewClient());
        player.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view; fullscreenCallback = callback;
                addContentView(view, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                player.setVisibility(View.GONE);
                setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
            }
            @Override public void onHideCustomView() { hideFullscreen(); }
        });
        player.loadUrl("https://animewallita.netlify.app/anime/" + android.net.Uri.encode(id == null ? "" : id));
        setContentView(player);
    }
    private void hideFullscreen() {
        if (fullscreenView == null) return;
        ((ViewGroup) fullscreenView.getParent()).removeView(fullscreenView);
        fullscreenView = null; player.setVisibility(View.VISIBLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (fullscreenCallback != null) { fullscreenCallback.onCustomViewHidden(); fullscreenCallback = null; }
    }
    @Override public void onBackPressed() { if (fullscreenView != null) hideFullscreen(); else if (player != null && player.canGoBack()) player.goBack(); else super.onBackPressed(); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
