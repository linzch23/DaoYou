package com.daoyou.plugin.backgroundlocation;

final class Gcj02Converter {
    private static final double A = 6378245.0;
    private static final double EE = 0.00669342162296594323;

    private Gcj02Converter() {}

    static double[] fromWgs84(double latitude, double longitude) {
        if (outsideChina(latitude, longitude)) {
            return new double[] {latitude, longitude};
        }
        double latitudeDelta = transformLatitude(longitude - 105.0, latitude - 35.0);
        double longitudeDelta = transformLongitude(longitude - 105.0, latitude - 35.0);
        double radians = latitude / 180.0 * Math.PI;
        double magic = Math.sin(radians);
        magic = 1 - EE * magic * magic;
        double sqrtMagic = Math.sqrt(magic);
        latitudeDelta = latitudeDelta * 180.0
                / ((A * (1 - EE)) / (magic * sqrtMagic) * Math.PI);
        longitudeDelta = longitudeDelta * 180.0
                / (A / sqrtMagic * Math.cos(radians) * Math.PI);
        return new double[] {latitude + latitudeDelta, longitude + longitudeDelta};
    }

    private static boolean outsideChina(double latitude, double longitude) {
        return longitude < 72.004 || longitude > 137.8347
                || latitude < 0.8293 || latitude > 55.8271;
    }

    private static double transformLatitude(double x, double y) {
        double value = -100 + 2 * x + 3 * y + 0.2 * y * y
                + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
        value += (20 * Math.sin(6 * x * Math.PI)
                + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
        value += (20 * Math.sin(y * Math.PI)
                + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
        return value + (160 * Math.sin(y / 12 * Math.PI)
                + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
    }

    private static double transformLongitude(double x, double y) {
        double value = 300 + x + 2 * y + 0.1 * x * x
                + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
        value += (20 * Math.sin(6 * x * Math.PI)
                + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
        value += (20 * Math.sin(x * Math.PI)
                + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
        return value + (150 * Math.sin(x / 12 * Math.PI)
                + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
    }
}
