package it.animewall.android;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import android.widget.ImageView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Caricamento immagini minimale: cache LRU, downscale e fade-in. */
final class ImageLoader {
    private static final ExecutorService POOL = Executors.newFixedThreadPool(3);
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final LruCache<String, Bitmap> CACHE =
            new LruCache<String, Bitmap>((int) (Runtime.getRuntime().maxMemory() / 8)) {
                @Override protected int sizeOf(String key, Bitmap value) { return value.getByteCount(); }
            };

    private ImageLoader() { }

    static void load(ImageView view, String url, int targetWidthPx) {
        view.setTag(url);
        view.setImageDrawable(null);
        if (url == null || url.isEmpty()) return;

        Bitmap cached = CACHE.get(url);
        if (cached != null) {
            view.setAlpha(1f);
            view.setImageBitmap(cached);
            return;
        }
        POOL.execute(() -> {
            Bitmap bitmap = downloadBest(url, targetWidthPx);
            if (bitmap == null) return;
            CACHE.put(url, bitmap);
            MAIN.post(() -> {
                if (!url.equals(view.getTag())) return; // la view è stata riutilizzata
                view.setAlpha(0f);
                view.setImageBitmap(bitmap);
                view.animate().alpha(1f).setDuration(220).start();
            });
        });
    }

    /** MyAnimeList serve miniature 50x70 (/r/50x70/...): togliendo il ridimensionamento si ottiene l'immagine grande. */
    private static String upgrade(String url) {
        if (!url.contains("myanimelist.net")) return url;
        String better = url.replaceAll("\\?.*$", "")
                .replaceAll("/r/\\d+x\\d+/", "/")
                .replaceAll("(?<=\\d)\\.(jpg|jpeg|webp|png)$", "l.$1");
        return better;
    }

    private static Bitmap downloadBest(String url, int targetWidthPx) {
        String better = upgrade(url);
        if (!better.equals(url)) {
            Bitmap bitmap = download(better, targetWidthPx);
            if (bitmap != null) return bitmap;
        }
        return download(url, targetWidthPx);
    }

    private static Bitmap download(String address, int targetWidthPx) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
            if (address.contains("animeworld")) connection.setRequestProperty("Referer", "https://www.animeworld.ac/");
            if (connection.getResponseCode() != 200) return null;

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream stream = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) out.write(buffer, 0, count);
            }
            byte[] bytes = out.toByteArray();

            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);

            int sample = 1;
            int wanted = Math.max(targetWidthPx, 1) * 2; // un po' di margine per la nitidezza
            while (bounds.outWidth / (sample * 2) >= wanted) sample *= 2;

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sample;
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
        } catch (Exception e) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}