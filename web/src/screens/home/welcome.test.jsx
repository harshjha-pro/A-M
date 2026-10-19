// welcome.test.jsx — Tests for the Personalized Wedding Welcome Screen.
import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from '../../test/axe.js';
import WelcomeScreen from './WelcomeScreen.jsx';

const NOW = Date.parse('2026-10-08T09:12:31Z');

describe('Personalized Wedding Welcome Screen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders all essential elements from reference design and passes accessibility', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);

    const countdownData = {
      weddingStartsAt: '2027-02-13T18:30:00Z',
      weddingStartDate: '2027-02-14',
    };

    const { container } = render(
      <MemoryRouter>
        <WelcomeScreen countdown={countdownData} />
      </MemoryRouter>
    );

    // 1. Monogram & Logo Subtitle
    expect(screen.getByAltText('A&M Monogram')).toBeInTheDocument();
    expect(screen.getByText(/wedding planner/i)).toBeInTheDocument();

    // 2. Menu and Profile
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/settings/account');
    expect(screen.getByAltText('Mahi Profile')).toBeInTheDocument();

    // 3. Central Illustration of Real Couple
    const coupleImg = screen.getByAltText(/Ayush & Mahi/i);
    expect(coupleImg).toHaveAttribute('src', '/art/welcome-couple-perfect.webp');

    // 4. Headline & Details
    expect(screen.getByText('Two Hearts')).toBeInTheDocument();
    expect(screen.getByAltText('One Journey')).toBeInTheDocument();
    expect(screen.getByText('Ayush & Mahi')).toBeInTheDocument();
    expect(screen.getByText(/14 – 16 Feb 2027/)).toBeInTheDocument();

    // 5. Four-part Minimal Countdown
    const timer = screen.getByRole('timer');
    expect(timer).toBeInTheDocument();
    expect(within(timer).getAllByText(/^\d\d$/).map((x) => x.textContent)).toEqual(['04', '05', '09', '17']);
    expect(within(timer).getByText(/Months/i)).toBeInTheDocument();
    expect(within(timer).getByText(/Days/i)).toBeInTheDocument();
    expect(within(timer).getByText(/Hours/i)).toBeInTheDocument();
    expect(within(timer).getByText(/Minutes/i)).toBeInTheDocument();

    // 6. Carousel Pagination Dots
    const dots = screen.getAllByRole('tab');
    expect(dots).toHaveLength(5);
    expect(dots[0]).toHaveAttribute('aria-selected', 'true');

    // 7. CTA
    const cta = screen.getByRole('link', { name: /View Our Plans/i });
    expect(cta).toHaveAttribute('href', '/tasks');

    // 8. Accessibility (Axe)
    expect(await axe(container)).toHaveNoViolations();
  });

  test('tapping carousel pagination dots switches active dot', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WelcomeScreen />
      </MemoryRouter>
    );

    const dots = screen.getAllByRole('tab');
    expect(dots[0]).toHaveAttribute('aria-selected', 'true');
    expect(dots[2]).toHaveAttribute('aria-selected', 'false');

    await user.click(dots[2]);
    expect(dots[2]).toHaveAttribute('aria-selected', 'true');
    expect(dots[0]).toHaveAttribute('aria-selected', 'false');
  });

  test('calls custom onViewPlans handler when provided', async () => {
    const user = userEvent.setup();
    const onViewPlans = vi.fn();

    render(
      <MemoryRouter>
        <WelcomeScreen onViewPlans={onViewPlans} />
      </MemoryRouter>
    );

    const cta = screen.getByRole('button', { name: /View Our Plans/i });
    await user.click(cta);
    expect(onViewPlans).toHaveBeenCalledOnce();
  });
});
