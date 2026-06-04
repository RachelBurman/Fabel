// Global test mock for @clerk/nextjs client hooks
module.exports = {
  useUser: jest.fn().mockReturnValue({ isSignedIn: false, user: null, isLoaded: true }),
  useClerk: jest.fn().mockReturnValue({ signOut: jest.fn() }),
  SignIn: jest.fn().mockReturnValue(null),
  ClerkProvider: jest.fn().mockImplementation(({ children }) => children),
}
