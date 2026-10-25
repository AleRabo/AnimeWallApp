package it.animewall.android;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.text.InputType;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Catalogo nativo Android. Il servizio remoto è usato solo come backend dati di AnimeWall. */
public class MainActivity extends AppCompatActivity {
    private static final String API = "https://animewallita.netlify.app";
    private static final String RELEASES = "https://api.github.com/repos/AleRabo/AnimeWallApp/releases?per_page=20";

    private static final int BG = Color.rgb(8, 9, 12);
    private static final int NAV = Color.rgb(15, 17, 23);
    private static final int PANEL = Color.rgb(21, 24, 34);
    private static final int ORANGE = Color.rgb(249, 115, 22);
    private static final int MUTED = Color.rgb(148, 156, 175);

    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final List<LinearLayout> tabs = new ArrayList<>();
    private LinearLayout content;
    private ScrollView scroll;
    private Runnable currentScreen;

    private long updateDownloadId = -1;
    private String downloadedApkName;
    private final BroadcastReceiver downloadReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())
                    && intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -2) == updateDownloadId) {
                installDownloadedUpdate();
            }
        }
    };

    // ------------------------------------------------------------------ ciclo di vita

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        buildShell();
        setupWindow();
        tabs.get(0).performClick(); // apre la Home
        ContextCompat.registerReceiver(this, downloadReceiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                ContextCompat.RECEIVER_NOT_EXPORTED);
        checkForUpdates();
    }

    @Override protected void onDestroy() {
        unregisterReceiver(downloadReceiver);
        executor.shutdownNow();
        super.onDestroy();
    }

    /** Edge-to-edge esplicito: con targetSdk 35 è comunque obbligatorio. */
    private void setupWindow() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) window.setNavigationBarContrastEnforced(false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }

    // ------------------------------------------------------------------ guscio dell'app

    private void buildShell() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG);

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        TextView mark = label("AW", 15, Color.BLACK, true);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(rounded(ORANGE, 12));
        bar.addView(mark, new LinearLayout.LayoutParams(dp(38), dp(38)));
        TextView title = label("ANIMEWALL", 19, Color.WHITE, true);
        title.setLetterSpacing(.08f);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        titleParams.setMargins(dp(12), 0, 0, 0);
        bar.addView(title, titleParams);
        TextView refresh = label("⟳", 22, Color.WHITE, false);
        refresh.setGravity(Gravity.CENTER);
        refresh.setBackground(rounded(PANEL, 20));
        ripple(refresh);
        refresh.setOnClickListener(v -> { if (currentScreen != null) currentScreen.run(); });
        bar.addView(refresh, new LinearLayout.LayoutParams(dp(40), dp(40)));
        root.addView(bar);

        scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(4), dp(16), dp(24));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout nav = new LinearLayout(this);
        nav.setBackgroundColor(NAV);
        addTab(nav, "⌂", "Home", this::showHome);
        addTab(nav, "⌕", "Cerca", this::showSearch);
        addTab(nav, "▦", "Calendario", this::showCalendar);
        addTab(nav, "★", "Top", () -> showFeed("Top anime", "/api/top-anime", "anime"));
        addTab(nav, "◷", "Prossime", () -> showFeed("Prossime uscite", "/api/upcoming", "anime"));
        root.addView(nav);

        // Le barre di sistema non devono coprire header e navigazione.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            bar.setPadding(dp(18) + b.left, dp(12) + b.top, dp(18) + b.right, dp(10));
            nav.setPadding(dp(4) + b.left, dp(4), dp(4) + b.right, dp(4) + b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        setContentView(root);
    }

    private void addTab(LinearLayout nav, String icon, String name, Runnable action) {
        int index = tabs.size();
        LinearLayout tab = new LinearLayout(this);
        tab.setOrientation(LinearLayout.VERTICAL);
        tab.setGravity(Gravity.CENTER);
        tab.setPadding(0, dp(8), 0, dp(8));
        TextView iconView = label(icon, 20, MUTED, false);
        iconView.setGravity(Gravity.CENTER);
        TextView nameView = label(name, 11, MUTED, false);
        nameView.setGravity(Gravity.CENTER);
        tab.addView(iconView);
        tab.addView(nameView);
        ripple(tab);
        tab.setOnClickListener(v -> { currentScreen = action; selectTab(index); action.run(); });
        tabs.add(tab);
        nav.addView(tab, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
    }

    private void selectTab(int selected) {
        for (int i = 0; i < tabs.size(); i++) {
            int color = i == selected ? ORANGE : MUTED;
            LinearLayout tab = tabs.get(i);
            ((TextView) tab.getChildAt(0)).setTextColor(color);
            ((TextView) tab.getChildAt(1)).setTextColor(color);
            ((TextView) tab.getChildAt(1)).setTypeface(Typeface.DEFAULT, i == selected ? Typeface.BOLD : Typeface.NORMAL);
        }
        scroll.scrollTo(0, 0);
    }

    // ------------------------------------------------------------------ schermate

    private void showHome() {
        clearContent();
        LinearLayout featured = block();
        content.addView(featured);
        loadFeatured(featured);
        addSection("Top anime", "/api/top-anime", "anime");
        addSection("Prossime uscite", "/api/upcoming", "anime");
    }

    private void showSearch() {
        clearContent();
        content.addView(heading("Cerca anime"));

        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        EditText query = new EditText(this);
        query.setHint("Titolo dell'anime");
        query.setHintTextColor(MUTED);
        query.setTextColor(Color.WHITE);
        query.setTextSize(15);
        query.setSingleLine(true);
        query.setInputType(InputType.TYPE_CLASS_TEXT);
        query.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        query.setBackground(rounded(PANEL, 16));
        query.setPadding(dp(16), dp(12), dp(16), dp(12));
        row.addView(query, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView button = pill("Cerca");
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        buttonParams.leftMargin = dp(10);
        row.addView(button, buttonParams);
        content.addView(row);

        LinearLayout results = block();
        LinearLayout.LayoutParams resultsParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        resultsParams.topMargin = dp(16);
        content.addView(results, resultsParams);
        results.addView(label("Scrivi il titolo di un anime e premi Cerca.", 14, MUTED, false));

        Runnable go = () -> {
            String value = query.getText().toString().trim();
            if (value.isEmpty()) return;
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null) imm.hideSoftInputFromWindow(query.getWindowToken(), 0);
            loadList(results, "/api/search?q=" + Uri.encode(value), "results", true, "Nessun risultato per \"" + value + "\".");
        };
        button.setOnClickListener(v -> go.run());
        query.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEARCH) { go.run(); return true; }
            return false;
        });
    }

    private void showFeed(String title, String path, String key) {
        clearContent();
        content.addView(heading(title));
        LinearLayout body = block();
        content.addView(body);
        loadList(body, path, key, true, "Nessun contenuto disponibile.");
    }

    // ------------------------------------------------------------------ caricamento sezioni

    /** In evidenza: il primo elemento diventa il banner, gli altri una riga di card. */
    private void loadFeatured(LinearLayout body) {
        body.removeAllViews();
        body.addView(skeleton(true, 1));
        fetchItems("/api/featured", "featured",
                items -> {
                    body.removeAllViews();
                    if (items.isEmpty()) { body.addView(label("Nessun anime in evidenza.", 15, MUTED, false)); return; }
                    body.addView(hero(items.get(0)));
                    if (items.size() > 1) {
                        body.addView(heading("In evidenza"));
                        body.addView(row(items.subList(1, items.size())));
                    }
                },
                e -> {
                    body.removeAllViews();
                    body.addView(errorView("/api/featured", e, () -> loadFeatured(body)));
                });
    }

    private void addSection(String title, String path, String key) {
        content.addView(heading(title));
        LinearLayout body = block();
        content.addView(body);
        loadList(body, path, key, false, "Nessun contenuto disponibile.");
    }

    private void loadList(LinearLayout body, String path, String key, boolean asGrid, String empty) {
        body.removeAllViews();
        body.addView(skeleton(false, asGrid ? 2 : 1));
        fetchItems(path, key,
                items -> {
                    body.removeAllViews();
                    if (items.isEmpty()) body.addView(label(empty, 15, MUTED, false));
                    else body.addView(asGrid ? grid(items) : row(items));
                },
                e -> {
                    body.removeAllViews();
                    body.addView(errorView(path, e, () -> loadList(body, path, key, asGrid, empty)));
                });
    }

    // ------------------------------------------------------------------ componenti UI

    private View hero(JSONObject item) {
        String id = idOf(item), title = titleOf(item), image = imageOf(item);
        int width = screenWidth() - dp(32);

        FrameLayout frame = new FrameLayout(this);
        frame.setBackground(rounded(PANEL, 20));
        Ui.clip(frame, 20);
        ImageView cover = new ImageView(this);
        cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
        frame.addView(cover, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        ImageLoader.load(cover, image, width);

        View shade = new View(this);
        shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{Color.TRANSPARENT, Color.argb(110, 8, 9, 12), Color.argb(240, 8, 9, 12)}));
        frame.addView(shade, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setPadding(dp(16), dp(16), dp(16), dp(16));
        TextView badge = label("IN EVIDENZA", 10, ORANGE, true);
        badge.setLetterSpacing(.12f);
        TextView name = label(title, 22, Color.WHITE, true);
        name.setMaxLines(2);
        name.setEllipsize(TextUtils.TruncateAt.END);
        TextView cta = pill("▶  Guarda ora");
        info.addView(badge);
        info.addView(name);
        LinearLayout.LayoutParams ctaParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        ctaParams.topMargin = dp(10);
        info.addView(cta, ctaParams);
        frame.addView(info, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));

        ripple(frame);
        frame.setOnClickListener(v -> openAnime(id, title, image));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.round(width * 0.62f));
        params.bottomMargin = dp(8);
        frame.setLayoutParams(params);
        return frame;
    }

    private View row(List<JSONObject> items) {
        HorizontalScrollView horizontal = new HorizontalScrollView(this);
        horizontal.setHorizontalScrollBarEnabled(false);
        LinearLayout cards = new LinearLayout(this);
        int width = dp(124);
        for (int i = 0; i < Math.min(items.size(), 20); i++) {
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(width, ViewGroup.LayoutParams.WRAP_CONTENT);
            params.rightMargin = dp(10);
            cards.addView(card(items.get(i), width), params);
        }
        horizontal.addView(cards);
        return horizontal;
    }

    private View grid(List<JSONObject> items) {
        int columns = screenWidth() >= dp(600) ? 5 : 3;
        int gap = dp(10);
        int cardWidth = (screenWidth() - dp(32) - gap * (columns - 1)) / columns;
        int total = Math.min(items.size(), 60);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        for (int start = 0; start < total; start += columns) {
            LinearLayout line = new LinearLayout(this);
            for (int c = 0; c < columns; c++) {
                int i = start + c;
                View cell = i < total ? card(items.get(i), cardWidth) : new View(this);
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(cardWidth, ViewGroup.LayoutParams.WRAP_CONTENT);
                if (c < columns - 1) params.rightMargin = gap;
                line.addView(cell, params);
            }
            LinearLayout.LayoutParams lineParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lineParams.bottomMargin = dp(14);
            box.addView(line, lineParams);
        }
        return box;
    }

    private View card(JSONObject item, int width) {
        String id = idOf(item), title = titleOf(item), image = imageOf(item), episode = text(item, "episodeNumber", "episode");
        String rank = text(item, "rank"), score = text(item, "score"), time = text(item, "time");
        boolean fromMal = !rank.isEmpty() && text(item, "url").contains("myanimelist");

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);

        FrameLayout poster = new FrameLayout(this);
        poster.setBackground(rounded(PANEL, 12));
        Ui.clip(poster, 12);
        ImageView cover = new ImageView(this);
        cover.setScaleType(ImageView.ScaleType.CENTER_CROP);
        poster.addView(cover, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        ImageLoader.load(cover, image, width);
        String badgeText = !episode.isEmpty() ? "EP " + episode + (time.isEmpty() ? "" : " · " + time)
                : (!rank.isEmpty() ? "#" + rank : "");
        if (!badgeText.isEmpty()) {
            TextView badge = label(badgeText, 10, Color.BLACK, true);
            badge.setBackground(rounded(ORANGE, 8));
            badge.setPadding(dp(7), dp(3), dp(7), dp(3));
            FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START);
            badgeParams.setMargins(dp(6), dp(6), 0, 0);
            poster.addView(badge, badgeParams);
        }
        if (!score.isEmpty()) {
            TextView star = label("★ " + score, 10, Color.WHITE, true);
            star.setBackground(rounded(Color.argb(190, 8, 9, 12), 8));
            star.setPadding(dp(7), dp(3), dp(7), dp(3));
            FrameLayout.LayoutParams starParams = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.START);
            starParams.setMargins(dp(6), 0, 0, dp(6));
            poster.addView(star, starParams);
        }
        card.addView(poster, new LinearLayout.LayoutParams(width, Math.round(width * 1.45f)));

        TextView name = label(title, 12.5f, Color.WHITE, true);
        name.setMinLines(2);
        name.setMaxLines(2);
        name.setEllipsize(TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(width, ViewGroup.LayoutParams.WRAP_CONTENT);
        nameParams.topMargin = dp(6);
        card.addView(name, nameParams);

        ripple(card);
        card.setOnClickListener(v -> { if (fromMal) openFromMal(title, image); else openAnime(id, title, image); });
        return card;
    }

    /** Segnaposto pulsanti mostrati durante il caricamento. */
    private View skeleton(boolean withHero, int rows) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        if (withHero) {
            View hero = new View(this);
            hero.setBackground(rounded(PANEL, 20));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.round((screenWidth() - dp(32)) * 0.62f));
            params.bottomMargin = dp(8);
            box.addView(hero, params);
        }
        for (int r = 0; r < rows; r++) {
            LinearLayout line = new LinearLayout(this);
            for (int i = 0; i < 3; i++) {
                View cell = new View(this);
                cell.setBackground(rounded(PANEL, 12));
                LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(110), dp(160));
                params.rightMargin = dp(10);
                params.bottomMargin = dp(10);
                line.addView(cell, params);
            }
            box.addView(line);
        }
        pulse(box);
        return box;
    }

    private void pulse(View view) {
        ObjectAnimator animator = ObjectAnimator.ofFloat(view, View.ALPHA, .45f, 1f);
        animator.setDuration(750);
        animator.setRepeatCount(ValueAnimator.INFINITE);
        animator.setRepeatMode(ValueAnimator.REVERSE);
        view.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
            @Override public void onViewAttachedToWindow(View v) { animator.start(); }
            @Override public void onViewDetachedFromWindow(View v) { animator.cancel(); }
        });
    }

    private View errorView(String path, Exception e, Runnable retry) {
        boolean network = e instanceof UnknownHostException || e instanceof SocketTimeoutException || e instanceof ConnectException;
        String detail = e.getMessage() == null ? "" : e.getMessage();
        if (detail.length() > 120) detail = detail.substring(0, 120) + "…";

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackground(rounded(PANEL, 16));
        box.setPadding(dp(16), dp(16), dp(16), dp(16));
        box.addView(label("Non riesco a caricare i contenuti", 15, Color.WHITE, true));
        TextView message = label(network ? "Controlla la connessione a Internet." : "Il servizio ha risposto in modo inatteso.", 13, Color.LTGRAY, false);
        message.setPadding(0, dp(4), 0, 0);
        box.addView(message);
        TextView technical = label(path + " · " + e.getClass().getSimpleName() + (detail.isEmpty() ? "" : ": " + detail), 11, MUTED, false);
        technical.setPadding(0, dp(6), 0, dp(12));
        box.addView(technical);
        TextView button = pill("Riprova");
        button.setOnClickListener(v -> retry.run());
        box.addView(button, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return box;
    }

    // ------------------------------------------------------------------ rete e parsing

    private void fetchItems(String path, String key, Consumer<List<JSONObject>> ok, Consumer<Exception> fail) {
        executor.execute(() -> {
            try {
                List<JSONObject> items = extractItems(fetch(path), key);
                runOnUiThread(() -> ok.accept(items));
            } catch (Exception e) {
                runOnUiThread(() -> fail.accept(e));
            }
        });
    }

    private Object fetch(String path) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(API + path).openConnection();
        try {
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("User-Agent", "AnimeWall-Android/" + BuildConfig.VERSION_NAME);
            int code = c.getResponseCode();
            if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
            String body;
            try (InputStream stream = c.getInputStream()) { body = read(stream).trim(); }
            if (body.isEmpty() || body.charAt(0) == '<') throw new IOException("risposta HTML invece di JSON");
            return new JSONTokener(body).nextValue();
        } finally {
            c.disconnect();
        }
    }

    private String read(InputStream stream) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int count;
        while ((count = stream.read(buffer)) != -1) out.write(buffer, 0, count);
        return out.toString("UTF-8");
    }

    /**
     * Trova la lista di anime nella risposta senza dipendere dalla forma esatta del JSON:
     * array in radice, chiave preferita (anche dentro "data"), oppure qualsiasi array di oggetti.
     */
    private List<JSONObject> extractItems(Object json, String key) {
        List<JSONObject> out = new ArrayList<>();
        Object scope = json;
        Object preferred = find(json, key, 0);
        if (preferred != null) scope = preferred;
        collect(scope, out, 0);
        return out;
    }

    private Object find(Object node, String key, int depth) {
        if (!(node instanceof JSONObject) || depth > 2) return null;
        JSONObject object = (JSONObject) node;
        Object value = object.opt(key);
        if (value != null && value != JSONObject.NULL) return value;
        Iterator<String> names = object.keys();
        while (names.hasNext()) {
            Object child = object.opt(names.next());
            if (child instanceof JSONObject) {
                Object found = find(child, key, depth + 1);
                if (found != null) return found;
            }
        }
        return null;
    }

    private void collect(Object node, List<JSONObject> out, int depth) {
        if (node == null || depth > 4) return;
        if (node instanceof JSONArray) {
            JSONArray array = (JSONArray) node;
            for (int i = 0; i < array.length(); i++) collect(array.opt(i), out, depth + 1);
        } else if (node instanceof JSONObject) {
            JSONObject object = (JSONObject) node;
            if (isItem(object)) { out.add(object); return; }
            Iterator<String> names = object.keys();
            while (names.hasNext()) collect(object.opt(names.next()), out, depth + 1);
        }
    }

    private boolean isItem(JSONObject o) {
        return o.has("title") || o.has("animeId") || (o.has("name") && !imageOf(o).isEmpty());
    }

    private String idOf(JSONObject o) { return text(o, "animeId", "id", "slug"); }

    private String titleOf(JSONObject o) {
        String title = text(o, "title", "name", "titleEnglish", "title_english", "romaji");
        return title.isEmpty() ? "Anime" : title;
    }

    private String imageOf(JSONObject o) {
        String url = text(o, "image", "cover", "coverUrl", "coverImage", "poster", "thumbnail", "img", "picture");
        if (url.startsWith("//")) return "https:" + url;
        if (url.startsWith("http://")) return "https://" + url.substring(7); // il cleartext è bloccato dal manifest
        if (url.startsWith("/")) return "https://www.animeworld.ac" + url;
        return url;
    }

    /** Primo valore non vuoto tra le chiavi date; gestisce anche valori annidati ({"english": ...}) e "null". */
    private String text(JSONObject o, String... keys) {
        for (String key : keys) {
            String value = flat(o.opt(key));
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    private String flat(Object value) {
        if (value == null || value == JSONObject.NULL || value instanceof JSONArray) return "";
        if (value instanceof JSONObject) {
            return text((JSONObject) value, "english", "romaji", "userPreferred", "default",
                    "extraLarge", "large", "medium", "url", "src", "native");
        }
        String s = String.valueOf(value).trim();
        return "null".equals(s) ? "" : s;
    }

    // ------------------------------------------------------------------ navigazione

    /** I "Top" arrivano da MyAnimeList: l'id è di MAL, non di AnimeWall. Cerco il titolo e apro il primo risultato. */
    private void openFromMal(String title, String image) {
        Toast.makeText(this, "Cerco \"" + title + "\" su AnimeWall…", Toast.LENGTH_SHORT).show();
        executor.execute(() -> {
            try {
                List<JSONObject> found = extractItems(fetch("/api/search?q=" + Uri.encode(title)), "results");
                if (found.isEmpty()) {
                    runOnUiThread(() -> Toast.makeText(this, "Non disponibile su AnimeWall.", Toast.LENGTH_LONG).show());
                    return;
                }
                JSONObject first = found.get(0);
                String foundImage = imageOf(first);
                runOnUiThread(() -> openAnime(idOf(first), titleOf(first), foundImage.isEmpty() ? image : foundImage));
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(this, "Ricerca non disponibile.", Toast.LENGTH_LONG).show());
            }
        });
    }

    /** Calendario raggruppato per giorno: /api/calendar restituisce [{date, label, episodes: [...]}]. */
    private void showCalendar() {
        clearContent();
        content.addView(heading("Calendario"));
        LinearLayout body = block();
        content.addView(body);
        loadCalendar(body);
    }

    private void loadCalendar(LinearLayout body) {
        body.removeAllViews();
        body.addView(skeleton(false, 2));
        executor.execute(() -> {
            try {
                Object json = fetch("/api/calendar");
                Object scope = find(json, "calendar", 0);
                List<JSONObject> days = new ArrayList<>();
                collectDays(scope != null ? scope : json, days, 0);
                List<JSONObject> flat = days.isEmpty() ? extractItems(json, "calendar") : null;
                runOnUiThread(() -> {
                    body.removeAllViews();
                    if (flat != null) {
                        if (flat.isEmpty()) body.addView(label("Nessuna uscita in programma.", 15, MUTED, false));
                        else body.addView(grid(flat));
                        return;
                    }
                    for (JSONObject day : days) {
                        List<JSONObject> episodes = new ArrayList<>();
                        collect(day.opt("episodes"), episodes, 0);
                        if (episodes.isEmpty()) continue;
                        String label = text(day, "label");
                        if (!label.isEmpty()) label = label.substring(0, 1).toUpperCase() + label.substring(1);
                        String date = text(day, "date");
                        if (date.length() == 10) label += "  ·  " + date.substring(8) + "/" + date.substring(5, 7);
                        TextView dayTitle = label(label.isEmpty() ? "Uscite" : label, 16, ORANGE, true);
                        dayTitle.setPadding(0, dp(14), 0, dp(8));
                        body.addView(dayTitle);
                        body.addView(grid(episodes));
                    }
                    if (body.getChildCount() == 0) body.addView(label("Nessuna uscita in programma.", 15, MUTED, false));
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    body.removeAllViews();
                    body.addView(errorView("/api/calendar", e, () -> loadCalendar(body)));
                });
            }
        });
    }

    private void collectDays(Object node, List<JSONObject> out, int depth) {
        if (node == null || depth > 3) return;
        if (node instanceof JSONArray) {
            JSONArray array = (JSONArray) node;
            for (int i = 0; i < array.length(); i++) collectDays(array.opt(i), out, depth + 1);
        } else if (node instanceof JSONObject) {
            JSONObject object = (JSONObject) node;
            if (object.opt("episodes") instanceof JSONArray) { out.add(object); return; }
            Iterator<String> names = object.keys();
            while (names.hasNext()) collectDays(object.opt(names.next()), out, depth + 1);
        }
    }

    private void openAnime(String id, String title, String image) {
        Intent intent = new Intent(this, AnimeDetailActivity.class);
        intent.putExtra(AnimeDetailActivity.EXTRA_ID, id);
        intent.putExtra(AnimeDetailActivity.EXTRA_TITLE, title);
        intent.putExtra(AnimeDetailActivity.EXTRA_IMAGE, image);
        startActivity(intent);
    }

    // ------------------------------------------------------------------ aggiornamenti

    private void checkForUpdates() {
        executor.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(RELEASES).openConnection();
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                JSONArray releases;
                try (InputStream stream = c.getInputStream()) { releases = new JSONArray(read(stream)); }
                for (int i = 0; i < releases.length(); i++) {
                    JSONObject release = releases.getJSONObject(i);
                    int version = versionCode(release.optString("tag_name"));
                    JSONArray assets = release.optJSONArray("assets");
                    if (assets == null || version <= BuildConfig.VERSION_CODE) continue;
                    for (int j = 0; j < assets.length(); j++) {
                        JSONObject asset = assets.getJSONObject(j);
                        String name = asset.optString("name");
                        if (name.startsWith("AnimeWall-android-") && name.endsWith(".apk")) {
                            String url = asset.optString("browser_download_url");
                            runOnUiThread(() -> offerUpdate(url, name));
                            return;
                        }
                    }
                }
            } catch (Exception ignored) {
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }

    private int versionCode(String tag) {
        try {
            String[] p = tag.replace("android-v", "").split("\\.");
            return Integer.parseInt(p[0]) * 10000 + Integer.parseInt(p[1]) * 100 + Integer.parseInt(p[2]);
        } catch (Exception e) {
            return 0;
        }
    }

    private void offerUpdate(String url, String name) {
        if (isFinishing()) return;
        new AlertDialog.Builder(this)
                .setTitle("Aggiornamento disponibile")
                .setMessage("È disponibile una nuova versione di AnimeWall.")
                .setNegativeButton("Più tardi", null)
                .setPositiveButton("Aggiorna", (d, w) -> downloadUpdate(url, name))
                .show();
    }

    private void downloadUpdate(String url, String name) {
        downloadedApkName = name;
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Aggiornamento AnimeWall");
        request.setDescription("Download della nuova versione");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);
        updateDownloadId = ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
        Toast.makeText(this, "Download dell'aggiornamento avviato", Toast.LENGTH_LONG).show();
    }

    private void installDownloadedUpdate() {
        if (downloadedApkName == null) return;
        if (!getPackageManager().canRequestPackageInstalls()) {
            startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            Toast.makeText(this, "Consenti l'installazione degli aggiornamenti e tocca di nuovo la notifica.", Toast.LENGTH_LONG).show();
            return;
        }
        File apk = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), downloadedApkName);
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(install);
    }

    // ------------------------------------------------------------------ utilità view

    private void clearContent() { content.removeAllViews(); }

    private LinearLayout block() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        return box;
    }

    private TextView heading(String value) {
        TextView h = label(value, 20, Color.WHITE, true);
        h.setPadding(0, dp(18), 0, dp(10));
        return h;
    }

    private TextView label(String value, float size, int color, boolean bold) {
        TextView text = new TextView(this);
        text.setText(value);
        text.setTextSize(size);
        text.setTextColor(color);
        if (bold) text.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return text;
    }

    private TextView pill(String value) {
        TextView pill = label(value, 13, Color.BLACK, true);
        pill.setGravity(Gravity.CENTER);
        pill.setBackground(rounded(ORANGE, 20));
        pill.setPadding(dp(18), dp(10), dp(18), dp(10));
        return pill;
    }

    private void ripple(View view) {
        TypedValue value = new TypedValue();
        if (getTheme().resolveAttribute(androidx.appcompat.R.attr.selectableItemBackground, value, true) && value.resourceId != 0) {
            view.setForeground(ContextCompat.getDrawable(this, value.resourceId));
        }
    }

    private GradientDrawable rounded(int color, int radiusDp) { return Ui.rounded(this, color, radiusDp); }
    private int screenWidth() { return getResources().getDisplayMetrics().widthPixels; }
    private int dp(int value) { return Ui.dp(this, value); }
}