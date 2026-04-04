package chibi

/*
#cgo CFLAGS: -I${SRCDIR}/chibi-src/include -I${SRCDIR}/chibi-build/include
#cgo LDFLAGS: ${SRCDIR}/chibi-build/libchibi-scheme.a -lm -ldl

#include <chibi/eval.h>

static sexp sexp_null() { return SEXP_NULL; }
static sexp sexp_false() { return SEXP_FALSE; }
static sexp sexp_true() { return SEXP_TRUE; }
static sexp sexp_seven() { return SEXP_SEVEN; }

static int is_pair(sexp x) { return sexp_pairp(x); }
static int is_fixnum(sexp x) { return sexp_fixnump(x); }
static int is_flonum(sexp x) { return sexp_flonump(x); }
static int is_string(sexp x) { return sexp_stringp(x); }
static int is_symbol(sexp x) { return sexp_symbolp(x); }
static int is_boolean(sexp x) { return sexp_booleanp(x); }
static int is_null(sexp x) { return sexp_nullp(x); }
static int is_exception(sexp x) { return sexp_exceptionp(x); }

static sexp get_car(sexp x) { return sexp_car(x); }
static sexp get_cdr(sexp x) { return sexp_cdr(x); }

static sexp wrap_sexp_cons(sexp ctx, sexp a, sexp b) {
    return sexp_cons(ctx, a, b);
}

static sexp wrap_sexp_symbol_to_string(sexp ctx, sexp s) {
    return sexp_symbol_to_string(ctx, s);
}

static long long unbox_fixnum(sexp x) { return sexp_unbox_fixnum(x); }
static double unbox_flonum(sexp x) { return sexp_flonum_value(x); }

static sexp make_fixnum(long long n) { return sexp_make_fixnum(n); }

static const char* get_string_data(sexp x) { return sexp_string_data(x); }
static size_t get_string_size(sexp x) { return sexp_string_size(x); }

static sexp get_context_env(sexp ctx) { return sexp_context_env(ctx); }

static void load_standard_ports(sexp ctx) {
    sexp_load_standard_ports(ctx, NULL, stdin, stdout, stderr, 1);
}

static int is_list(sexp ctx, sexp x) { return sexp_listp(ctx, x) != SEXP_FALSE; }
*/
import "C"
import (
	"fmt"
	"reflect"
	"unsafe"
)

type Context struct {
	ctx C.sexp
}

// MakeEvalContext creates a new evaluation context.
func MakeEvalContext(parent *Context, stack C.sexp, env C.sexp, size, maxSize uint64) *Context {
	var pCtx C.sexp
	if parent != nil {
		pCtx = parent.ctx
	}
	ctx := C.sexp_make_eval_context(pCtx, stack, env, C.sexp_uint_t(size), C.sexp_uint_t(maxSize))
	if parent == nil {
		C.sexp_load_standard_env(ctx, nil, C.sexp_seven())
		C.load_standard_ports(ctx)
	}
	return &Context{ctx: ctx}
}

// NewContext creates a default evaluation context.
func NewContext() *Context {
	return MakeEvalContext(nil, nil, nil, 0, 0)
}

// ChildContext creates a new context sharing the same environment.
func (c *Context) ChildContext() *Context {
	return MakeEvalContext(c, nil, C.get_context_env(c.ctx), 0, 0)
}

// Execute executes a scheme script and returns the result.
func (c *Context) Execute(script string) (any, error) {
	cStr := C.CString(script)
	defer C.free(unsafe.Pointer(cStr))

	res := C.sexp_eval_string(c.ctx, cStr, -1, C.get_context_env(c.ctx))
	if C.is_exception(res) != 0 {
		return nil, fmt.Errorf("scheme exception")
	}

	return c.SexpToGo(res), nil
}

// Define defines a new value in the context.
func (c *Context) Define(name string, val any) error {
	cName := C.CString(name)
	defer C.free(unsafe.Pointer(cName))

	sym := C.sexp_intern(c.ctx, cName, -1)
	sVal := c.GoToSexp(val)

	C.sexp_env_define(c.ctx, C.get_context_env(c.ctx), sym, sVal)
	return nil
}

// SexpToGo converts a sexp to a Go object.
func (c *Context) SexpToGo(s C.sexp) any {
	if C.is_null(s) != 0 {
		return nil
	}
	if C.is_boolean(s) != 0 {
		return s != C.sexp_false()
	}
	if C.is_fixnum(s) != 0 {
		return int64(C.unbox_fixnum(s))
	}
	if C.is_flonum(s) != 0 {
		return float64(C.unbox_flonum(s))
	}
	if C.is_string(s) != 0 {
		return C.GoStringN(C.get_string_data(s), C.int(C.get_string_size(s)))
	}
	if C.is_symbol(s) != 0 {
		str := C.wrap_sexp_symbol_to_string(c.ctx, s)
		return C.GoStringN(C.get_string_data(str), C.int(C.get_string_size(str)))
	}
	if C.is_pair(s) != 0 {
		if C.is_list(c.ctx, s) != 0 {
			// Check for alist
			isAlist := true
			count := 0
			curr := s
			for C.is_null(curr) == 0 {
				car := C.get_car(curr)
				if C.is_pair(car) == 0 {
					isAlist = false
					break
				}
				curr = C.get_cdr(curr)
				count++
			}

			if isAlist && count > 0 {
				res := make(map[string]any)
				curr = s
				for C.is_null(curr) == 0 {
					pair := C.get_car(curr)
					key := c.SexpToGo(C.get_car(pair))
					val := c.SexpToGo(C.get_cdr(pair))
					res[fmt.Sprint(key)] = val
					curr = C.get_cdr(curr)
				}
				return res
			}

			var res []any
			curr = s
			for C.is_null(curr) == 0 {
				res = append(res, c.SexpToGo(C.get_car(curr)))
				curr = C.get_cdr(curr)
			}
			return res
		}
		// Improper list or just a pair
		return []any{c.SexpToGo(C.get_car(s)), c.SexpToGo(C.get_cdr(s))}
	}
	return nil
}

// GoToSexp converts a Go object to a sexp.
func (c *Context) GoToSexp(v any) C.sexp {
	if v == nil {
		return C.sexp_null()
	}

	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Bool:
		if v.(bool) {
			return C.sexp_true()
		}
		return C.sexp_false()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return C.make_fixnum(C.longlong(rv.Int()))
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return C.make_fixnum(C.longlong(rv.Uint()))
	case reflect.Float32, reflect.Float64:
		return C.sexp_make_flonum(c.ctx, C.double(rv.Float()))
	case reflect.String:
		s := v.(string)
		cStr := C.CString(s)
		defer C.free(unsafe.Pointer(cStr))
		return C.sexp_c_string(c.ctx, cStr, C.sexp_sint_t(len(s)))
	case reflect.Slice, reflect.Array:
		res := C.sexp_null()
		for i := rv.Len() - 1; i >= 0; i-- {
			elem := c.GoToSexp(rv.Index(i).Interface())
			res = C.wrap_sexp_cons(c.ctx, elem, res)
		}
		return res
	case reflect.Map:
		res := C.sexp_null()
		keys := rv.MapKeys()
		for i := len(keys) - 1; i >= 0; i-- {
			key := keys[i]
			val := rv.MapIndex(key)

			sKey := c.GoToSexp(key.Interface())
			if key.Kind() == reflect.String {
				cStr := C.CString(key.String())
				sKey = C.sexp_intern(c.ctx, cStr, -1)
				C.free(unsafe.Pointer(cStr))
			}

			sVal := c.GoToSexp(val.Interface())
			pair := C.wrap_sexp_cons(c.ctx, sKey, sVal)
			res = C.wrap_sexp_cons(c.ctx, pair, res)
		}
		return res
	}

	return C.sexp_null()
}
