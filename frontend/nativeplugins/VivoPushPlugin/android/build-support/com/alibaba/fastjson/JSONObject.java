package com.alibaba.fastjson;

import java.util.HashMap;

public class JSONObject extends HashMap<String, Object> {
    public String getString(String key) {
        Object value = get(key);
        return value == null ? null : value.toString();
    }

    public int getIntValue(String key) {
        Object value = get(key);
        return value instanceof Number ? ((Number) value).intValue() : 0;
    }
}
