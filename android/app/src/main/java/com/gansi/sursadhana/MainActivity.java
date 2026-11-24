package com.gansi.sursadhana;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Grant WebRTC getUserMedia (mic) requests from the bundled PWA.
        // Android runtime RECORD_AUDIO is requested by the WebView flow;
        // without this override the permission request is denied silently.
        getBridge().getWebView().setWebChromeClient(
            new BridgeWebChromeClient(getBridge()) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        try {
                            request.grant(request.getResources());
                        } catch (Exception e) {
                            request.deny();
                        }
                    });
                }
            }
        );
    }
}
