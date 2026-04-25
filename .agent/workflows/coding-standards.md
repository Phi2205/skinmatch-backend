# Coding Standards - Response Structure

All API responses must follow this standard JSON structure:

```json
{
  "success": true,
  "message": "A human-readable message explaining the result",
  "data": {
    "key": "value"
  }
}
```

- `success`: boolean, indicates if the operation was successful.
- `message`: string, a short description of the outcome (e.g., "Login successful", "Validation failed").
- `data`: object, contains the actual payload of the response. If there is no data to return, it can be `null` or an empty object, but the key should still exist for consistency.

Example conversion:
BEFORE:
```typescript
return {
  success: true,
  user: result.user,
};
```

AFTER:
```typescript
return {
  success: true,
  message: 'Login successful',
  data: {
    user: result.user,
  },
};
```
