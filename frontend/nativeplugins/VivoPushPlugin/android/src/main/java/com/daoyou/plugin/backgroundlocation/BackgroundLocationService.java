package com.daoyou.plugin.backgroundlocation;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class BackgroundLocationService extends Service implements LocationListener {
    static final String ACTION_START = "com.daoyou.backgroundlocation.START";
    static final String EXTRA_BASE_URL = "baseUrl";
    static final String EXTRA_USER_ID = "userId";
    private static final String TAG = "DaoYouBackgroundLocation";
    private static final String CHANNEL_ID = "daoyou_trip_location";
    private static final int NOTIFICATION_ID = 27001;
    private static final long INTERVAL_MS = 15 * 60 * 1000L;
    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);

    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean uploading = new AtomicBoolean(false);
    private LocationManager locationManager;
    private String baseUrl;
    private int userId;

    static boolean isRunning() {
        return RUNNING.get();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        RUNNING.set(true);
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_START.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        baseUrl = intent.getStringExtra(EXTRA_BASE_URL);
        userId = intent.getIntExtra(EXTRA_USER_ID, 0);
        if (baseUrl == null || userId <= 0 || !hasLocationPermission()) {
            Log.w(TAG, "Stopping: invalid config or location permission missing");
            stopSelf();
            return START_NOT_STICKY;
        }
        startLocationUpdates();
        return START_REDELIVER_INTENT;
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    @SuppressWarnings("MissingPermission")
    private void startLocationUpdates() {
        locationManager.removeUpdates(this);
        String provider = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
        locationManager.requestLocationUpdates(provider, INTERVAL_MS, 0, this);
        Location last = locationManager.getLastKnownLocation(provider);
        if (last != null && System.currentTimeMillis() - last.getTime() <= INTERVAL_MS) {
            upload(last);
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        upload(location);
    }

    @Override
    public void onProviderDisabled(String provider) {
        Log.w(TAG, "Location provider disabled");
    }

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    private void upload(Location location) {
        if (!uploading.compareAndSet(false, true)) {
            return;
        }
        double[] gcj02 = Gcj02Converter.fromWgs84(
                location.getLatitude(), location.getLongitude());
        long timestamp = location.getTime() / 1000L;
        networkExecutor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URL endpoint = new URL(baseUrl + "/api/location");
                connection = (HttpURLConnection) endpoint.openConnection();
                connection.setRequestMethod("PUT");
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                String body = String.format(Locale.US,
                        "{\"user_id\":%d,\"latitude\":%.8f,\"longitude\":%.8f,\"timestamp\":%d}",
                        userId, gcj02[0], gcj02[1], timestamp);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body.getBytes(StandardCharsets.UTF_8));
                }
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) {
                    Log.w(TAG, "Location upload failed with HTTP " + status);
                }
            } catch (Exception exception) {
                Log.w(TAG, "Location upload failed: "
                        + exception.getClass().getSimpleName());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
                uploading.set(false);
            }
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "行程位置提醒", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("在有效行程期间更新位置，用于出发提醒");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return builder
                .setContentTitle("导友正在为当前行程提供位置提醒")
                .setContentText("约每 15 分钟更新一次位置")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.i(TAG, "Task removed; foreground location service remains active");
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (locationManager != null) {
            locationManager.removeUpdates(this);
        }
        networkExecutor.shutdownNow();
        RUNNING.set(false);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
