function Get-GitAutoversion {
    # Mock implementation for the agent environment
    # In a real scenario, this would calculate the version based on git tags/commits
    return @{
        version = "0.5.0"
        tag = "v0.5.0"
        commit = "a1b2c3d"
    }
}

Export-ModuleMember -Function Get-GitAutoversion
