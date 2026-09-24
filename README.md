# Sun Compass V1

A small phone-friendly solar compass using SunCalc and browser device-orientation APIs.

## Run

Serve the folder from a web server. For phone sensor APIs, use HTTPS in normal browser deployments.

Example:

    python -m http.server 8000

`http://localhost:8000` is useful for desktop testing. A phone accessing the computer over LAN will normally need HTTPS for sensor APIs.

## Files

- `index.html` — UI
- `style.css` — styling
- `app.js` — SunCalc integration, time controls, orientation and calibration

## Notes

- Default coordinates are placeholders and can be changed with Settings.
- The SunCalc library is loaded from jsDelivr in this V1.
- The visual sun marker is deliberately a simple 2D directional representation. V2 can replace it with a camera background and a more physically meaningful sky projection.
- Compass readings vary between devices and can be affected by magnetic interference.

## V1.1

- Automatically requests phone geolocation on startup.
- Uses `watchPosition()` to update coordinates if the phone moves.
- Saves the last successful coordinates locally.
- Ignores tiny compass-heading changes to reduce stationary flicker.


## V1.2

- Added a Camera + trajectory tab.
- Uses the rear camera when available.
- Draws the calculated solar trajectory over the camera image.
- Shows hourly trajectory labels and the current Sun position.
- The trajectory is based on the current phone heading and configured/GPS location.


## V1.3

The camera trajectory now uses the phone's front/back tilt (`beta`) in addition to heading. Portrait orientation is assumed: upright points at the horizon, tilting upward moves the virtual Sun upward on the camera overlay.
