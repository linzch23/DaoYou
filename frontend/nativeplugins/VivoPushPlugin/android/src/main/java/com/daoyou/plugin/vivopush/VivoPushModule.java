package com.daoyou.plugin.vivopush;

import android.content.Context;
import android.util.Log;

import com.alibaba.fastjson.JSONObject;
import com.vivo.push.IPushActionListener;
import com.vivo.push.PushClient;
import com.vivo.push.PushConfig;
import com.vivo.push.listener.IPushQueryActionListener;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.bridge.UniJSCallback;
import io.dcloud.feature.uniapp.common.UniModule;

/**
 * vivo Push SDK UniApp 原生插件。
 * <p>
 * 从 JS 层调用：
 * <pre>
 * const plugin = uni.requireNativePlugin('VivoPushPlugin');
 * plugin.initialize({}, res => console.log(res));
 * plugin.turnOnPush({}, res => console.log(res));
 * plugin.getRegId({}, res => console.log(res));
 * </pre>
 * <p>
 * vivo SDK 用到的 appId / appKey 从 AndroidManifest meta-data 读取，
 * 需要在打包前替换 AndroidManifest.xml 中的 YOUR_VIVO_APP_ID / YOUR_VIVO_API_KEY。
 */
public class VivoPushModule extends UniModule {

    private static final String TAG = "VivoPushPlugin";

    private boolean initialized = false;

    // -------------------------------------------------------------------------
    // JS 可调方法
    // -------------------------------------------------------------------------

    /**
     * 初始化 vivo Push SDK。
     * 调用一次即可，重复调用安全（幂等）。
     */
    @UniJSMethod(uiThread = false)
    public void initialize(JSONObject options, UniJSCallback callback) {
        if (initialized) {
            callback.invoke(successResult("already_initialized", "SDK already initialized"));
            return;
        }
        try {
            PushClient.getInstance(getUniContext()).initialize(buildPushConfig());
            initialized = true;
            Log.i(TAG, "vivo Push SDK initialized");
            callback.invoke(successResult("initialized", "SDK initialized"));
        } catch (Exception e) {
            Log.e(TAG, "initialize failed", e);
            callback.invoke(errorResult("init_failed", e.getMessage()));
        }
    }

    /**
     * 开启推送服务。
     * state=0 表示成功，此时可调用 getRegId。
     */
    @UniJSMethod(uiThread = false)
    public void turnOnPush(JSONObject options, UniJSCallback callback) {
        if (!ensureInit(callback)) {
            return;
        }
        PushClient.getInstance(getUniContext()).turnOnPush(new IPushActionListener() {
            @Override
            public void onStateChanged(int state) {
                Log.i(TAG, "turnOnPush state=" + state);
                JSONObject result = new JSONObject();
                result.put("state", state);
                if (state == 0) {
                    result.put("success", true);
                    result.put("message", "推送服务已开启");
                } else {
                    result.put("success", false);
                    result.put("message", "推送服务开启失败，请检查 AppID/AppKey/包名/签名");
                }
                callback.invoke(result);
            }
        });
    }

    /**
     * 获取 regId。
     * 必须在 turnOnPush 成功后调用。
     */
    @UniJSMethod(uiThread = false)
    public void getRegId(JSONObject options, UniJSCallback callback) {
        if (!ensureInit(callback)) {
            return;
        }
        PushClient.getInstance(getUniContext()).getRegId(new IPushQueryActionListener() {
            @Override
            public void onSuccess(String regId) {
                Log.i(TAG, "getRegId success regId=" + regId);
                JSONObject result = new JSONObject();
                result.put("success", true);
                result.put("regId", regId);
                callback.invoke(result);
            }

            @Override
            public void onFail(Integer errorCode) {
                Log.e(TAG, "getRegId fail errorCode=" + errorCode);
                JSONObject result = new JSONObject();
                result.put("success", false);
                result.put("errorCode", errorCode);
                result.put("message", "获取 regId 失败，请确认 turnOnPush 已成功");
                callback.invoke(result);
            }
        });
    }

    /**
     * 一次性执行：turnOnPush + getRegId。
     * 简化 JS 调用。
     */
    @UniJSMethod(uiThread = false)
    public void register(JSONObject options, UniJSCallback callback) {
        if (!ensureInit(callback)) {
            return;
        }
        PushClient.getInstance(getUniContext()).turnOnPush(new IPushActionListener() {
            @Override
            public void onStateChanged(int state) {
                if (state != 0) {
                    JSONObject result = new JSONObject();
                    result.put("success", false);
                    result.put("step", "turnOnPush");
                    result.put("state", state);
                    result.put("message", "推送服务开启失败 state=" + state);
                    callback.invoke(result);
                    return;
                }
                PushClient.getInstance(getUniContext())
                        .getRegId(new IPushQueryActionListener() {
                            @Override
                            public void onSuccess(String regId) {
                                JSONObject result = new JSONObject();
                                result.put("success", true);
                                result.put("regId", regId);
                                callback.invoke(result);
                            }

                            @Override
                            public void onFail(Integer errorCode) {
                                JSONObject result = new JSONObject();
                                result.put("success", false);
                                result.put("step", "getRegId");
                                result.put("errorCode", errorCode);
                                result.put("message", "获取 regId 失败 errorCode=" + errorCode);
                                callback.invoke(result);
                            }
                        });
            }
        });
    }

    // -------------------------------------------------------------------------
    // 内部方法
    // -------------------------------------------------------------------------

    private Context getUniContext() {
        try {
            Class<?> type = getClass();
            while (type != null) {
                try {
                    java.lang.reflect.Field field = type.getDeclaredField("mUniSDKInstance");
                    field.setAccessible(true);
                    Object sdkInstance = field.get(this);
                    return (Context) sdkInstance.getClass().getMethod("getContext").invoke(sdkInstance);
                } catch (NoSuchFieldException ignored) {
                    type = type.getSuperclass();
                }
            }
            throw new IllegalStateException("mUniSDKInstance not found");
        } catch (Exception e) {
            throw new IllegalStateException("Unable to obtain UniApp context", e);
        }
    }
    private boolean ensureInit(UniJSCallback callback) {
        if (initialized) {
            return true;
        }
        try {
            PushClient.getInstance(getUniContext()).initialize(buildPushConfig());
            initialized = true;
            Log.i(TAG, "vivo Push SDK auto-initialized");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "auto initialize failed", e);
            callback.invoke(errorResult("init_failed", e.getMessage()));
            return false;
        }
    }

    private PushConfig buildPushConfig() {
        return new PushConfig.Builder()
                .agreePrivacyStatement(true)
                .build();
    }

    private JSONObject successResult(String code, String message) {
        JSONObject obj = new JSONObject();
        obj.put("success", true);
        obj.put("code", code);
        obj.put("message", message);
        return obj;
    }

    private JSONObject errorResult(String code, String message) {
        JSONObject obj = new JSONObject();
        obj.put("success", false);
        obj.put("code", code);
        obj.put("message", message);
        return obj;
    }
}




