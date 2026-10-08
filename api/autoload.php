<?php
declare(strict_types=1);

// A&M Wedding API autoloader. Uses Composer's when vendor/ exists (dev, and
// later sessions with packages); otherwise a tiny PSR-4 loader for AM\ → src/.
if (is_file(__DIR__ . '/vendor/autoload.php')) {
    require __DIR__ . '/vendor/autoload.php';
} else {
    spl_autoload_register(static function (string $class): void {
        if (str_starts_with($class, 'AM\\')) {
            $file = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, 3)) . '.php';
            if (is_file($file)) {
                require $file;
            }
        }
    });
}
