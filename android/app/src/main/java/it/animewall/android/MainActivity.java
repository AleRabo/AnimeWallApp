package it.animewall.android;

import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native Android catalogue. The remote service is used only as AnimeWall's data backend. */
public class MainActivity extends AppCompatActivity {
    private static final String API = "https://animewallita.netlify.app";
    private static final String RELEASES = "https://api.github.com/repos/AleRabo/AnimeWallApp/releases?per_page=20";
    private static final int BG = Color.rgb(8, 9, 12);
    private static final int PANEL = Color.rgb(21, 24, 34);
    private static final int ORANGE = Color.rgb(249, 115, 22);

    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private LinearLayout content;
    private long updateDownloadId = -1;
    private String downloadedApkName;
    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())
                    && intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -2) == updateDownloadId) installDownloadedUpdate();
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        buildShell(); showHome();
        ContextCompat.registerReceiver(this, downloadReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_NOT_EXPORTED);
        checkForUpdates();
    }

    private void buildShell() {
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(BG);
        LinearLayout bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(dp(18), dp(14), dp(18), dp(12));
        TextView mark = label("AW", 18, Color.BLACK, true); mark.setGravity(Gravity.CENTER); mark.setBackgroundColor(ORANGE);
        bar.addView(mark, new LinearLayout.LayoutParams(dp(42), dp(42)));
        TextView title = label("ANIMEWALL", 20, Color.WHITE, true); title.setLetterSpacing(.08f);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1); titleParams.setMargins(dp(12), 0, 0, 0); bar.addView(title, titleParams);
        Button refresh = textButton("⟳"); refresh.setOnClickListener(v -> showHome()); bar.addView(refresh); root.addView(bar);

        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true);
        content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(16), dp(4), dp(16), dp(24)); scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        LinearLayout nav = new LinearLayout(this); nav.setGravity(Gravity.CENTER); nav.setPadding(dp(4), dp(8), dp(4), dp(8)); nav.setBackgroundColor(Color.rgb(15, 17, 23));
        addNav(nav, "⌂", "Home", this::showHome); addNav(nav, "⌕", "Cerca", this::showSearch);
        addNav(nav, "▦", "Calendario", () -> showFeed("Calendario", "/api/calendar", "calendar"));
        addNav(nav, "★", "Top", () -> showFeed("Top anime", "/api/top-anime", "anime"));
        addNav(nav, "◷", "Prossime", () -> showFeed("Prossime uscite", "/api/upcoming", "anime")); root.addView(nav); setContentView(root);
    }

    private void addNav(LinearLayout parent, String icon, String description, Runnable action) {
        Button button = new Button(this); button.setText(icon + "\n" + description); button.setTextSize(11); button.setTextColor(Color.LTGRAY); button.setAllCaps(false); button.setBackgroundColor(Color.TRANSPARENT); button.setOnClickListener(v -> action.run()); parent.addView(button, new LinearLayout.LayoutParams(0, dp(58), 1));
    }

    private void showHome() {
        clearContent(); content.addView(label("Anime gratis, interfaccia pensata per Android.", 13, Color.LTGRAY, false)); content.addView(spacer(12)); addHeading("In evidenza"); addLoading();
        executor.execute(() -> {
            try { JSONObject data = getJson("/api/featured"); JSONArray items = data.optJSONArray("featured"); runOnUiThread(() -> { removeLoading(); renderCards(items, "Nessun anime in evidenza."); }); }
            catch (Exception e) { showError("Non riesco a caricare i contenuti. Controlla la connessione."); }
        });
    }

    private void showSearch() {
        clearContent(); addHeading("Cerca anime"); LinearLayout row = new LinearLayout(this);
        EditText query = new EditText(this); query.setHint("Titolo dell'anime"); query.setHintTextColor(Color.GRAY); query.setTextColor(Color.WHITE); query.setSingleLine(true); query.setInputType(InputType.TYPE_CLASS_TEXT); row.addView(query, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        Button search = textButton("Cerca"); row.addView(search); content.addView(row);
        search.setOnClickListener(v -> { String value = query.getText().toString().trim(); if (value.isEmpty()) return; addLoading(); executor.execute(() -> {
            try { JSONObject data = getJson("/api/search?q=" + Uri.encode(value)); JSONArray items = data.optJSONArray("results"); if (items == null) items = data.optJSONArray("anime"); JSONArray finalItems = items; runOnUiThread(() -> { removeLoading(); renderCards(finalItems, "Nessun risultato."); }); }
            catch (Exception e) { showError("Ricerca non disponibile."); }
        }); });
    }

    private void showFeed(String title, String path, String preferredKey) {
        clearContent(); addHeading(title); addLoading(); executor.execute(() -> {
            try { JSONObject data = getJson(path); JSONArray items = data.optJSONArray(preferredKey); if (items == null) items = data.optJSONArray("items"); if (items == null) items = data.optJSONArray("episodes"); JSONArray finalItems = items; runOnUiThread(() -> { removeLoading(); renderCards(finalItems, "Nessun contenuto disponibile."); }); }
            catch (Exception e) { showError("Pagina non disponibile."); }
        });
    }

    private void renderCards(JSONArray items, String empty) {
        if (items == null || items.length() == 0) { content.addView(label(empty, 15, Color.GRAY, false)); return; }
        HorizontalScrollView horizontal = new HorizontalScrollView(this); horizontal.setHorizontalScrollBarEnabled(false); LinearLayout cards = new LinearLayout(this); cards.setPadding(0, dp(8), 0, dp(8)); horizontal.addView(cards);
        for (int i = 0; i < Math.min(items.length(), 20); i++) { JSONObject item = items.optJSONObject(i); if (item != null) cards.addView(card(item)); } content.addView(horizontal);
    }

    private View card(JSONObject item) {
        String id = item.optString("animeId", item.optString("id")); String title = item.optString("title", "Anime"); String image = item.optString("image", item.optString("cover", item.optString("coverUrl")));
        LinearLayout card = new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); card.setPadding(dp(8), dp(8), dp(8), dp(8)); card.setBackgroundColor(PANEL);
        ImageView cover = new ImageView(this); cover.setScaleType(ImageView.ScaleType.CENTER_CROP); cover.setBackgroundColor(Color.DKGRAY); card.addView(cover, new LinearLayout.LayoutParams(dp(130), dp(184))); if (!image.isEmpty()) loadImage(image, cover);
        TextView name = label(title, 13, Color.WHITE, true); name.setMaxLines(2); LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(dp(130), ViewGroup.LayoutParams.WRAP_CONTENT); nameParams.topMargin = dp(8); card.addView(name, nameParams);
        String episode = item.optString("episodeNumber"); if (!episode.isEmpty()) card.addView(label("Episodio " + episode, 11, ORANGE, true)); LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(146), ViewGroup.LayoutParams.WRAP_CONTENT); params.setMargins(0, 0, dp(12), 0); card.setLayoutParams(params); card.setOnClickListener(v -> openAnime(id, title)); return card;
    }

    private void openAnime(String id, String title) { Intent intent = new Intent(this, AnimeDetailActivity.class); intent.putExtra(AnimeDetailActivity.EXTRA_ID, id); intent.putExtra(AnimeDetailActivity.EXTRA_TITLE, title); startActivity(intent); }
    private JSONObject getJson(String path) throws Exception { HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection(); c.setConnectTimeout(10000); c.setReadTimeout(15000); c.setRequestProperty("Accept", "application/json"); try (InputStream stream = c.getInputStream()) { return new JSONObject(read(stream)); } }
    private String read(InputStream stream) throws Exception { ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[4096]; int count; while ((count = stream.read(buffer)) != -1) out.write(buffer, 0, count); return out.toString("UTF-8"); }
    private void loadImage(String address, ImageView view) { executor.execute(() -> { try (InputStream stream = new URL(address).openStream()) { Bitmap bitmap = BitmapFactory.decodeStream(stream); runOnUiThread(() -> view.setImageBitmap(bitmap)); } catch (Exception ignored) { } }); }

    private void checkForUpdates() { executor.execute(() -> { try { HttpURLConnection c = (HttpURLConnection) new URL(RELEASES).openConnection(); c.setRequestProperty("Accept", "application/vnd.github+json"); c.setConnectTimeout(8000); c.setReadTimeout(8000); JSONArray releases = new JSONArray(read(c.getInputStream())); for (int i = 0; i < releases.length(); i++) { JSONObject release = releases.getJSONObject(i); int version = versionCode(release.optString("tag_name")); JSONArray assets = release.optJSONArray("assets"); if (assets == null || version <= BuildConfig.VERSION_CODE) continue; for (int j = 0; j < assets.length(); j++) { JSONObject asset = assets.getJSONObject(j); String name = asset.optString("name"); if (name.startsWith("AnimeWall-android-") && name.endsWith(".apk")) { runOnUiThread(() -> offerUpdate(asset.optString("browser_download_url"), name)); return; } } } } catch (Exception ignored) { } }); }
    private int versionCode(String tag) { try { String[] p = tag.replace("android-v", "").split("\\."); return Integer.parseInt(p[0]) * 10000 + Integer.parseInt(p[1]) * 100 + Integer.parseInt(p[2]); } catch (Exception e) { return 0; } }
    private void offerUpdate(String url, String name) { new AlertDialog.Builder(this).setTitle("Aggiornamento disponibile").setMessage("È disponibile una nuova versione di AnimeWall.").setNegativeButton("Più tardi", null).setPositiveButton("Aggiorna", (d, w) -> downloadUpdate(url, name)).show(); }
    private void downloadUpdate(String url, String name) { downloadedApkName = name; DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url)); request.setTitle("Aggiornamento AnimeWall"); request.setDescription("Download della nuova versione"); request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED); request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name); updateDownloadId = ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request); Toast.makeText(this, "Download dell'aggiornamento avviato", Toast.LENGTH_LONG).show(); }
    private void installDownloadedUpdate() { if (downloadedApkName == null) return; if (!getPackageManager().canRequestPackageInstalls()) { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); Toast.makeText(this, "Consenti l'installazione degli aggiornamenti e tocca di nuovo la notifica.", Toast.LENGTH_LONG).show(); return; } File apk = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), downloadedApkName); Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk); Intent install = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(install); }
    private void clearContent() { content.removeAllViews(); }
    private void addHeading(String value) { TextView h = label(value, 22, Color.WHITE, true); h.setPadding(0, dp(12), 0, dp(6)); content.addView(h); }
    private void addLoading() { ProgressBar bar = new ProgressBar(this); bar.setTag("loading"); LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT); p.gravity = Gravity.CENTER_HORIZONTAL; p.topMargin = dp(32); content.addView(bar, p); }
    private void removeLoading() { View loading = content.findViewWithTag("loading"); if (loading != null) content.removeView(loading); }
    private void showError(String message) { runOnUiThread(() -> { removeLoading(); content.addView(label(message, 15, Color.LTGRAY, false)); }); }
    private TextView label(String value, int size, int color, boolean bold) { TextView text = new TextView(this); text.setText(value); text.setTextSize(size); text.setTextColor(color); if (bold) text.setTypeface(Typeface.DEFAULT, Typeface.BOLD); return text; }
    private Button textButton(String text) { Button button = new Button(this); button.setText(text); button.setTextColor(Color.WHITE); button.setTextSize(13); button.setAllCaps(false); return button; }
    private View spacer(int height) { View view = new View(this); view.setLayoutParams(new LinearLayout.LayoutParams(1, dp(height))); return view; }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onDestroy() { unregisterReceiver(downloadReceiver); executor.shutdownNow(); super.onDestroy(); }
}
