package com.daoyou.plugin.backgroundlocation;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.alibaba.fastjson.JSONObject;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.bridge.UniJSCallback;
import io.dcloud.feature.uniapp.common.UniModule;

public class BackgroundLocationModule extends UniModule {
    @UniJSMethod(uiThread = false)
    public void startBackgroundLocation(JSONObject options, UniJSCallback callback) {
        JSONObject result = new JSONObject();
        try {
            String baseUrl = requireString(options, "baseUrl");
            int userId = options.getIntValue("userId");
            if (userId <= 0) {
                throw new IllegalArgumentException("userId must be positive");
            }
            Context context = getUniContext();
            Intent intent = new Intent(context, BackgroundLocationService.class);
            intent.setAction(BackgroundLocationService.ACTION_START);
            intent.putExtra(BackgroundLocationService.EXTRA_BASE_URL, baseUrl);
            intent.putExtra(BackgroundLocationService.EXTRA_USER_ID, userId);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            result.put("success", true);
            result.put("running", true);
        } catch (Exception exception) {
            result.put("success", false);
            result.put("code", "start_failed");
            result.put("message", exception.getMessage());
        }
        callback.invoke(result);
    }

    @UniJSMethod(uiThread = false)
    public void stopBackgroundLocation(JSONObject options, UniJSCallback callback) {
        Context context = getUniContext();
        context.stopService(new Intent(context, BackgroundLocationService.class));
        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("running", false);
        callback.invoke(result);
    }

    @UniJSMethod(uiThread = false)
    public void getBackgroundLocationStatus(JSONObject options, UniJSCallback callback) {
        JSONObject result = new JSONObject();
        result.put("success", true);
        result.put("running", BackgroundLocationService.isRunning());
        callback.invoke(result);
    }

    private static String requireString(JSONObject options, String name) {
        String value = options == null ? null : options.getString(name);
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException(name + " is required");
        }
        if (!value.startsWith("https://")
                && !value.startsWith("http://localhost")
                && !value.startsWith("http://10.0.2.2")) {
            throw new IllegalArgumentException("baseUrl must use HTTPS");
        }
        return value.replaceAll("/+$", "");
    }

    private Context getUniContext() {
        try {
            Class<?> type = getClass();
            while (type != null) {
                try {
                    java.lang.reflect.Field field = type.getDeclaredField("mUniSDKInstance");
                    field.setAccessible(true);
                    Object instance = field.get(this);
                    return (Context) instance.getClass().getMethod("getContext").invoke(instance);
                } catch (NoSuchFieldException ignored) {
                    type = type.getSuperclass();
                }
            }
            throw new IllegalStateException("mUniSDKInstance not found");
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to obtain UniApp context", exception);
        }
    }
}
