use serde::Serialize;

pub const VK_LBUTTON: i32 = 0x01;
pub const VK_ESCAPE: i32 = 0x1B;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EyedropperPreview {
    pub x: i32,
    pub y: i32,
    pub hex: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub grid_size: u32,
    pub pixels: Vec<u8>,
}

#[cfg(windows)]
pub fn cursor_position() -> Result<(i32, i32), String> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    unsafe {
        let mut point = POINT::default();
        GetCursorPos(&mut point).map_err(|e| e.to_string())?;
        Ok((point.x, point.y))
    }
}

#[cfg(windows)]
pub fn is_key_down(vk: i32) -> bool {
    use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;

    unsafe { GetAsyncKeyState(vk) < 0 }
}

#[cfg(windows)]
fn with_desktop_dc<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(windows::Win32::Graphics::Gdi::HDC) -> Result<R, String>,
{
    use windows::Win32::Graphics::Gdi::{GetDC, ReleaseDC};
    use windows::Win32::UI::WindowsAndMessaging::GetDesktopWindow;

    unsafe {
        let hwnd = GetDesktopWindow();
        let hdc = GetDC(hwnd);
        if hdc.is_invalid() {
            return Err("failed to read screen".into());
        }
        let result = f(hdc);
        let _ = ReleaseDC(hwnd, hdc);
        result
    }
}

#[cfg(windows)]
unsafe fn read_pixel(
    hdc: windows::Win32::Graphics::Gdi::HDC,
    x: i32,
    y: i32,
) -> Result<(u8, u8, u8), String> {
    use windows::Win32::Foundation::COLORREF;
    use windows::Win32::Graphics::Gdi::GetPixel;

    let color = GetPixel(hdc, x, y);
    if color == COLORREF(0xFFFFFFFF) {
        return Err("failed to sample color".into());
    }
    let value = color.0;
    let r = (value & 0xFF) as u8;
    let g = ((value >> 8) & 0xFF) as u8;
    let b = ((value >> 16) & 0xFF) as u8;
    Ok((r, g, b))
}

#[cfg(windows)]
pub fn sample_pixel(x: i32, y: i32) -> Result<(u8, u8, u8), String> {
    with_desktop_dc(|hdc| unsafe { read_pixel(hdc, x, y) })
}

#[cfg(windows)]
pub fn build_eyedropper_preview(cx: i32, cy: i32, radius: i32) -> Result<EyedropperPreview, String> {
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
        SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, SRCCOPY,
    };

    with_desktop_dc(|hdc_screen| unsafe {
        let side = radius * 2 + 1;
        let left = cx - radius;
        let top = cy - radius;

        let hdc_mem = CreateCompatibleDC(hdc_screen);
        if hdc_mem.is_invalid() {
            return Err("failed to capture screen region".into());
        }

        let hbmp = CreateCompatibleBitmap(hdc_screen, side, side);
        if hbmp.is_invalid() {
            let _ = DeleteDC(hdc_mem);
            return Err("failed to capture screen region".into());
        }

        let hbmp_obj = windows::Win32::Graphics::Gdi::HGDIOBJ::from(hbmp);
        let old = SelectObject(hdc_mem, hbmp_obj);
        if BitBlt(hdc_mem, 0, 0, side, side, hdc_screen, left, top, SRCCOPY).is_err() {
            let _ = SelectObject(hdc_mem, old);
            let _ = DeleteObject(hbmp_obj);
            let _ = DeleteDC(hdc_mem);
            return Err("failed to capture screen region".into());
        }

        let mut bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: side,
                biHeight: -side,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let byte_len = (side * side * 4) as usize;
        let mut buf = vec![0u8; byte_len];
        let lines = GetDIBits(
            hdc_mem,
            hbmp,
            0,
            side as u32,
            Some(buf.as_mut_ptr().cast()),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        let _ = SelectObject(hdc_mem, old);
        let _ = DeleteObject(hbmp_obj);
        let _ = DeleteDC(hdc_mem);

        if lines == 0 {
            return Err("failed to read screen pixels".into());
        }

        let grid_size = side as u32;
        let mut pixels = Vec::with_capacity((side * side * 3) as usize);
        for chunk in buf.chunks_exact(4) {
            pixels.push(chunk[2]);
            pixels.push(chunk[1]);
            pixels.push(chunk[0]);
        }

        let center = (radius * side + radius) as usize * 4;
        let r = buf[center + 2];
        let g = buf[center + 1];
        let b = buf[center];

        Ok(EyedropperPreview {
            x: cx,
            y: cy,
            hex: rgb_to_hex(r, g, b),
            r,
            g,
            b,
            grid_size,
            pixels,
        })
    })
}

#[cfg(windows)]
pub fn position_window_hwnd(hwnd: isize, x: i32, y: i32) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOCOPYBITS, SWP_NOSIZE,
    };

    unsafe {
        let _ = SetWindowPos(
            HWND(hwnd as _),
            HWND_TOPMOST,
            x,
            y,
            0,
            0,
            SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOCOPYBITS,
        );
    }
}

#[cfg(not(windows))]
pub fn cursor_position() -> Result<(i32, i32), String> {
    Err("screen color picking is only supported on Windows".into())
}

#[cfg(not(windows))]
pub fn is_key_down(_vk: i32) -> bool {
    false
}

#[cfg(not(windows))]
pub fn sample_pixel(_x: i32, _y: i32) -> Result<(u8, u8, u8), String> {
    Err("screen color picking is only supported on Windows".into())
}

#[cfg(not(windows))]
pub fn build_eyedropper_preview(_cx: i32, _cy: i32, _radius: i32) -> Result<EyedropperPreview, String> {
    Err("screen color picking is only supported on Windows".into())
}

#[cfg(not(windows))]
pub fn position_window_hwnd(_hwnd: isize, _x: i32, _y: i32) {}

pub fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02x}{:02x}{:02x}", r, g, b)
}
