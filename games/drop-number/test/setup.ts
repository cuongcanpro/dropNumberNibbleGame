import { installMemoryStorage } from '@repo/game-kit/testing';

// Node 22+ có sẵn `localStorage` nhưng không dùng được khi thiếu `--localstorage-file`; dùng bản
// MemoryStorage chung của game-kit thay vì chép lại.
installMemoryStorage();
