package com.nexora.backend.infrastructure.security;

import com.nexora.backend.domain.model.User;
import com.nexora.backend.domain.model.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

@RequiredArgsConstructor
public class CustomUserDetails implements UserDetails {

    private final User user;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    public String getTenantId() {
        return user.getTenantId().toString();
    }

    public String getRole() {
        return user.getRole().name();
    }

    public String getDisplayName() {
        String name = user.getName();
        if (name == null || name.isBlank()) {
            return user.getRole() == Role.SUPER_ADMIN ? "Wasilio Staff" : user.getEmail();
        }
        return name.trim();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
