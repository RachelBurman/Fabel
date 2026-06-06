// Default: no session — API routes fall back to guestId from request
module.exports = {
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue(null)
    }
  }
}
