// Global test mock — auth() returns no session so routes fall back to guestId from request
module.exports = {
  auth: jest.fn().mockResolvedValue({ userId: null }),
}
