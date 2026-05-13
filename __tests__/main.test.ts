type Mock = jest.Mock

const flushPromises = async (cycles = 10): Promise<void> => {
    for (let i = 0; i < cycles; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve))
    }
}

describe('main', () => {
    let setFailedMock: Mock
    let setOutputMock: Mock
    let getInputMock: Mock
    let getLatestReleaseMock: Mock
    let compareCommitsMock: Mock
    let getCommitMock: Mock

    beforeEach(() => {
        jest.resetModules()

        setFailedMock = jest.fn()
        setOutputMock = jest.fn()
        getInputMock = jest.fn((name: string) => {
            if (name === 'head-ref') return 'HEAD'
            if (name === 'format') return '- {{subject}} by @{{author}}'
            return ''
        })
        getLatestReleaseMock = jest.fn()
        compareCommitsMock = jest.fn()
        getCommitMock = jest.fn()

        jest.doMock('@actions/core', () => ({
            getInput: getInputMock,
            setOutput: setOutputMock,
            setFailed: setFailedMock,
        }))
        jest.doMock('@actions/github', () => ({
            context: { repo: { owner: 'test-owner', repo: 'test-repo' } },
            getOctokit: () => ({
                rest: {
                    repos: {
                        getLatestRelease: getLatestReleaseMock,
                        compareCommitsWithBasehead: compareCommitsMock,
                        getCommit: getCommitMock,
                    },
                },
            }),
        }))
    })

    afterEach(() => {
        delete process.env.GITHUB_TOKEN
    })

    const runMain = async (): Promise<void> => {
        await jest.isolateModulesAsync(async () => {
            await import('../src/main')
            await flushPromises()
        })
    }

    test('fails when GITHUB_TOKEN is not set', async () => {
        delete process.env.GITHUB_TOKEN
        await runMain()
        expect(setFailedMock).toHaveBeenCalledWith('env.GITHUB_TOKEN is not set')
        expect(getLatestReleaseMock).not.toHaveBeenCalled()
    })

    test('emits notes from compareCommits when a release exists, with commits reversed', async () => {
        process.env.GITHUB_TOKEN = 'fake-token'
        getLatestReleaseMock.mockResolvedValue({ data: { tag_name: 'v1.0.0' } })
        compareCommitsMock.mockResolvedValue({
            data: {
                commits: [
                    {
                        author: { login: 'alice' },
                        committer: { login: 'alice' },
                        commit: { message: 'first commit' },
                    },
                    {
                        author: { login: 'bob' },
                        committer: { login: 'bob' },
                        commit: { message: 'second commit\n\nbody' },
                    },
                ],
            },
        })

        await runMain()

        expect(compareCommitsMock).toHaveBeenCalledWith({
            owner: 'test-owner',
            repo: 'test-repo',
            basehead: 'v1.0.0...HEAD',
        })
        expect(setOutputMock).toHaveBeenCalledWith('release-name', 'second commit')
        expect(setOutputMock).toHaveBeenCalledWith(
            'release-notes',
            '- second commit by @bob\n- first commit by @alice\n',
        )
        expect(setFailedMock).not.toHaveBeenCalled()
    })

    test('falls back to a single commit when no release exists', async () => {
        process.env.GITHUB_TOKEN = 'fake-token'
        getLatestReleaseMock.mockRejectedValue(new Error('no release'))
        getCommitMock.mockResolvedValue({
            data: {
                author: { login: 'alice' },
                committer: { login: 'alice' },
                commit: { message: 'lone commit' },
            },
        })

        await runMain()

        expect(getCommitMock).toHaveBeenCalledWith({
            owner: 'test-owner',
            repo: 'test-repo',
            ref: 'HEAD',
        })
        expect(compareCommitsMock).not.toHaveBeenCalled()
        expect(setOutputMock).toHaveBeenCalledWith('release-name', 'lone commit')
        expect(setOutputMock).toHaveBeenCalledWith('release-notes', '- lone commit by @alice\n')
    })

    test('fails when compareCommits returns no commits', async () => {
        process.env.GITHUB_TOKEN = 'fake-token'
        getLatestReleaseMock.mockResolvedValue({ data: { tag_name: 'v1.0.0' } })
        compareCommitsMock.mockResolvedValue({ data: { commits: [] } })

        await runMain()

        expect(setFailedMock).toHaveBeenCalledWith('No commits found between refs v1.0.0...HEAD')
        expect(setOutputMock).not.toHaveBeenCalled()
    })

    test('reports the inner error when both getLatestRelease and getCommit reject', async () => {
        process.env.GITHUB_TOKEN = 'fake-token'
        getLatestReleaseMock.mockRejectedValue(new Error('no release'))
        getCommitMock.mockRejectedValue(new Error('bad ref'))

        await runMain()

        expect(setFailedMock).toHaveBeenCalledTimes(1)
        const [arg] = setFailedMock.mock.calls[0]
        expect(arg).toBeInstanceOf(Error)
        expect((arg as Error).message).toBe('bad ref')
    })

    test('reports the compareCommits error when fetching commits rejects', async () => {
        process.env.GITHUB_TOKEN = 'fake-token'
        getLatestReleaseMock.mockResolvedValue({ data: { tag_name: 'v1.0.0' } })
        compareCommitsMock.mockRejectedValue(new Error('compare failed'))

        await runMain()

        expect(setFailedMock).toHaveBeenCalledTimes(1)
        const [arg] = setFailedMock.mock.calls[0]
        expect(arg).toBeInstanceOf(Error)
        expect((arg as Error).message).toBe('compare failed')
    })

    test('honors the format input for the release-notes output', async () => {
        process.env.GITHUB_TOKEN = 'fake-token'
        getInputMock.mockImplementation((name: string) => {
            if (name === 'head-ref') return 'HEAD'
            if (name === 'format') return '* {{subject}}'
            return ''
        })
        getLatestReleaseMock.mockResolvedValue({ data: { tag_name: 'v1.0.0' } })
        compareCommitsMock.mockResolvedValue({
            data: {
                commits: [
                    {
                        author: { login: 'alice' },
                        committer: null,
                        commit: { message: 'only commit' },
                    },
                ],
            },
        })

        await runMain()

        expect(setOutputMock).toHaveBeenCalledWith('release-notes', '* only commit\n')
    })
})
