import BootstrapValidator from '../BootstrapValidator';

describe('BootstrapValidator', () => {
  it('returns true when no keys are provided', () => {
    expect(BootstrapValidator.isValid({}, {})).toBe(true);
  });

  it('returns true when stable id is present', () => {
    expect(
      BootstrapValidator.isValid(
        {},
        {
          evaluated_keys: {
            stableID: 'a-stable-id',
            customIDs: {
              stableID: 'a-stable-id',
            },
          },
        },
      ),
    ).toBe(true);
  });

  it('returns true when user matched evaluted_keys', () => {
    const result = BootstrapValidator.isValid(
      { userID: 'a-user-id', customIDs: { workID: 'a-work-id' } },
      {
        evaluated_keys: {
          userID: 'a-user-id',
          customIDs: {
            stableID: 'a-stable-id',
            workID: 'a-work-id',
          },
        },
      },
    );

    expect(result).toBe(true);
  });

  it('returns false when userid doesnt match empty evaluted_keys', () => {
    const result = BootstrapValidator.isValid(
      { userID: 'a-user-id'},
      {
        evaluated_keys: {},
      },
    );

    expect(false).toBe(result);
  });

  it('returns false when customid doesnt match empty evaluted_keys', () => {
    const result = BootstrapValidator.isValid(
      { customIDs: {workID: 'a-work-id'}},
      {
        evaluated_keys: {},
      },
    );

    expect(false).toBe(result);
  });

  it('returns false when userid doesnt match empty evaluted_keys', () => {
    const result = BootstrapValidator.isValid(
      { userID: 'a-user-id'},
      {
        evaluated_keys: {},
      },
    );

    expect(result).toBe(false);
  });

  it('returns false when customid doesnt match empty user', () => {
    const result = BootstrapValidator.isValid(
      {},
      {
        evaluated_keys: {workID: 'a-work-id'},
      },
    );

    expect(result).toBe(false);
  });

  it('returns false when userid doesnt match empty user', () => {
    const result = BootstrapValidator.isValid(
      {},
      {
        evaluated_keys: {userID: 'a-user-id'},
      },
    );

    expect(false).toBe(result);
  });

  it('returns false when userID does not match', () => {
    const result = BootstrapValidator.isValid(
      { userID: 'a-user-id', customIDs: { workID: 'a-work-id' } },
      {
        evaluated_keys: {
          userID: 'an-invalid-user-id',
          customIDs: {
            stableID: 'a-stable-id',
            workID: 'a-work-id',
          },
        },
      },
    );
    expect(false).toBe(result);
  });

  it('returns true by ignoring stableID', () => {
    const result = BootstrapValidator.isValid(
      { userID: 'a-user-id', customIDs: { workID: 'a-work-id' } },
      {
        evaluated_keys: {
          userID: 'a-user-id',
          customIDs: {
            stableID: 'an-invalid-stable-id',
            workID: 'a-work-id',
          },
        },
      },
    );
    expect(result).toBe(true);
  });

  it('returns true by ignoring stableID from user', () => {
    const user = {
      userID: 'a-user-id',
      customIDs: { workID: 'a-work-id', stableID: 'a-stable-id' },
    };
    const result = BootstrapValidator.isValid(user, {
      evaluated_keys: {
        userID: 'a-user-id',
        customIDs: {
          workID: 'a-work-id',
        },
      },
    });
    expect(result).toBe(true);
  });

  it('returns false when customIDs do not match', () => {
    const result = BootstrapValidator.isValid(
      { userID: 'a-user-id', customIDs: { workID: 'a-work-id' } },
      {
        evaluated_keys: {
          userID: 'a-user-id',
          customIDs: {
            stableID: 'a-stable-id',
            workID: 'an-invalid-work-id',
          },
        },
      },
    );
    expect(result).toBe(false);
  });

  it('returns false when customIDs contains more values', () => {
    const result = BootstrapValidator.isValid(
      {
        userID: 'a-user-id',
        customIDs: { workID: 'a-work-id', groupID: 'a-group-id' },
      },
      {
        evaluated_keys: {
          userID: 'a-user-id',
          customIDs: {
            stableID: 'a-stable-id',
            workID: 'a-work-id',
          },
        },
      },
    );
    expect(result).toBe(false);
  });
});
