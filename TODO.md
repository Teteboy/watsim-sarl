# TODO - Mobile login failure

## Step 1
- Update plan approved by user.
- Modify `Watsim-app/lib/services/api_service.dart` to make API base URL configurable (no hard-coded IP).

## Step 2
- Improve login error handling so backend error message/status/body shows in the login UI.

## Step 3
- Run Flutter app and test:
  - confirm /health works from phone
  - attempt login with PIN and verify error surface from backend

